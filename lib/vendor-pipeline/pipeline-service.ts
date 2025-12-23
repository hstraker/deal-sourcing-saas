/**
 * Vendor Pipeline Service
 * Main background service that orchestrates the vendor acquisition pipeline
 * Runs continuously, polling for new leads and processing active conversations
 */

import { prisma } from "@/lib/db"
import { facebookLeadAdsService } from "./facebook"
import { aiSMSAgent } from "./ai-sms-agent"
import { dealValidator } from "./deal-validator"
import { offerEngine } from "./offer-engine"
import { PipelineStage } from "@prisma/client"
import { getPipelineConfig } from "./config"

export class VendorPipelineService {
  private config = getPipelineConfig()
  private running = false
  private intervalId: NodeJS.Timeout | null = null

  /**
   * Start the pipeline service
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn("Pipeline service is already running")
      return
    }

    this.running = true
    console.log("🚀 Vendor Pipeline Service started")

    // Run immediately
    await this.runCycle()

    // Then run on interval
    this.intervalId = setInterval(
      () => this.runCycle(),
      this.config.pipelinePollInterval * 1000
    )
  }

  /**
   * Stop the pipeline service
   */
  stop(): void {
    if (!this.running) {
      return
    }

    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    console.log("🛑 Vendor Pipeline Service stopped")
  }

  /**
   * Main service cycle
   */
  private async runCycle(): Promise<void> {
    try {
      console.log(`[Pipeline] Running cycle at ${new Date().toISOString()}`)

      // 1. Process new Facebook leads
      await this.processNewFacebookLeads()

      // 2. Process active AI conversations
      await this.processActiveConversations()

      // 3. Process pending validations
      await this.processPendingValidations()

      // 4. Send scheduled retries
      await this.processScheduledRetries()

      // 5. Process accepted deals
      await this.processAcceptedDeals()

      // 6. Clean up stale conversations
      await this.cleanupStaleLeads()

      // 7. Update metrics (once per hour)
      const now = new Date()
      if (now.getMinutes() === 0) {
        await this.updateMetrics()
      }

      console.log(`[Pipeline] Cycle completed`)
    } catch (error: any) {
      console.error("[Pipeline] Error in service cycle:", error)
    }
  }

  /**
   * Fetch new leads from Facebook and start conversations
   */
  private async processNewFacebookLeads(): Promise<void> {
    try {
      // Get last processed lead time
      const lastSync = await prisma.facebookLeadSync.findFirst({
        orderBy: { syncedAt: "desc" },
      })

      const since = lastSync?.syncedAt || new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

      const newLeads = await facebookLeadAdsService.fetchNewLeads(undefined, since)

      for (const leadData of newLeads) {
        // Check if already processed
        const existing = await prisma.vendorLead.findFirst({
          where: { facebookLeadId: leadData.facebookLeadId },
        })

        if (existing) {
          continue
        }

        // Create new vendor lead
        const vendorLead = await prisma.vendorLead.create({
          data: {
            facebookLeadId: leadData.facebookLeadId,
            leadSource: "facebook_ads",
            campaignId: leadData.campaignId,
            vendorName: leadData.vendorName,
            vendorPhone: leadData.vendorPhone,
            vendorEmail: leadData.vendorEmail,
            propertyAddress: leadData.propertyAddress,
            askingPrice: leadData.askingPrice,
            pipelineStage: "NEW_LEAD" as PipelineStage,
          },
        })

        // Record sync
        await prisma.facebookLeadSync.create({
          data: {
            facebookLeadId: leadData.facebookLeadId,
            vendorLeadId: vendorLead.id,
            leadData: leadData as any,
            processedAt: new Date(),
          },
        })

        // Send initial SMS
        await aiSMSAgent.sendInitialMessage(vendorLead.id)

        console.log(`[Pipeline] Processed new Facebook lead: ${vendorLead.id}`)
      }
    } catch (error: any) {
      console.error("[Pipeline] Error processing Facebook leads:", error)
    }
  }

  /**
   * Process active conversations waiting for AI responses
   */
  private async processActiveConversations(): Promise<void> {
    try {
      // This is handled by webhook, but we can check for any missed messages
      // In a production system, you'd want to handle this via webhooks instead
      // This method is kept for completeness and fallback handling
    } catch (error: any) {
      console.error("[Pipeline] Error processing conversations:", error)
    }
  }

  /**
   * Run BMV validation on deals ready for offers
   */
  private async processPendingValidations(): Promise<void> {
    try {
      const pendingLeads = await prisma.vendorLead.findMany({
        where: {
          pipelineStage: "DEAL_VALIDATION" as PipelineStage,
          validationPassed: null,
        },
      })

      for (const lead of pendingLeads) {
        const validation = await dealValidator.validateDeal(lead.id)

        const updateData: any = {
          validationPassed: validation.passed,
          validationNotes: validation.validationNotes,
          validatedAt: new Date(),
        }

        if (validation.bmvScore !== null) {
          updateData.bmvScore = validation.bmvScore
        }
        if (validation.estimatedMarketValue !== null) {
          updateData.estimatedMarketValue = validation.estimatedMarketValue
        }
        if (validation.estimatedRefurbCost !== null) {
          updateData.estimatedRefurbCost = validation.estimatedRefurbCost
        }
        if (validation.profitPotential !== null) {
          updateData.profitPotential = validation.profitPotential
        }

        if (validation.passed) {
          // Calculate and send offer
          const offerCalc = await offerEngine.calculateOffer(lead.id)
          updateData.offerAmount = offerCalc.offerAmount
          updateData.offerPercentage = offerCalc.offerPercentage

          await prisma.vendorLead.update({
            where: { id: lead.id },
            data: updateData,
          })

          // Send offer
          await offerEngine.sendOffer(lead.id)
        } else {
          // Mark as dead lead
          updateData.pipelineStage = "DEAD_LEAD" as PipelineStage
          await prisma.vendorLead.update({
            where: { id: lead.id },
            data: updateData,
          })
        }

        console.log(`[Pipeline] Validated lead ${lead.id}: ${validation.passed ? "PASSED" : "FAILED"}`)
      }
    } catch (error: any) {
      console.error("[Pipeline] Error processing validations:", error)
    }
  }

  /**
   * Send retry messages for rejected offers
   */
  private async processScheduledRetries(): Promise<void> {
    try {
      const retryLeads = await prisma.vendorLead.findMany({
        where: {
          pipelineStage: {
            in: ["VIDEO_SENT", "RETRY_1", "RETRY_2"] as PipelineStage[],
          },
          nextRetryAt: {
            lte: new Date(),
          },
          retryCount: {
            lt: 3,
          },
        },
      })

      for (const lead of retryLeads) {
        const retryNumber = (lead.retryCount + 1) as 1 | 2 | 3
        await offerEngine.sendRetry(lead.id, retryNumber)
        console.log(`[Pipeline] Sent retry ${retryNumber} for lead ${lead.id}`)
      }
    } catch (error: any) {
      console.error("[Pipeline] Error processing retries:", error)
    }
  }

  /**
   * Move accepted deals to investor matching
   */
  private async processAcceptedDeals(): Promise<void> {
    try {
      const acceptedLeads = await prisma.vendorLead.findMany({
        where: {
          pipelineStage: "OFFER_ACCEPTED" as PipelineStage,
          solicitorName: { not: null },
        },
      })

      for (const lead of acceptedLeads) {
        // Create Deal record
        const deal = await prisma.deal.create({
          data: {
            address: lead.propertyAddress || "Unknown",
            postcode: lead.propertyPostcode || null,
            askingPrice: lead.offerAmount || lead.askingPrice || 0,
            marketValue: lead.estimatedMarketValue || null,
            estimatedRefurbCost: lead.estimatedRefurbCost || null,
            bmvPercentage: lead.bmvScore || null,
            propertyType: lead.propertyType || null,
            bedrooms: lead.bedrooms || null,
            bathrooms: lead.bathrooms || null,
            dataSource: "vendor_acquisition",
            status: "ready",
            vendorSolicitorName: lead.solicitorName || null,
            vendorSolicitorEmail: lead.solicitorEmail || null,
            vendorSolicitorPhone: lead.solicitorPhone || null,
            lockOutAgreementSent: lead.lockoutAgreementSent,
          },
        })

        // Link vendor to deal
        await prisma.vendor.updateMany({
          where: { phone: lead.vendorPhone },
          data: { dealId: deal.id },
        })

        // Update vendor lead
        await prisma.vendorLead.update({
          where: { id: lead.id },
          data: {
            dealId: deal.id,
            pipelineStage: "READY_FOR_INVESTORS" as PipelineStage,
            dealClosedAt: new Date(),
          },
        })

        console.log(`[Pipeline] Created deal ${deal.id} from vendor lead ${lead.id}`)
      }
    } catch (error: any) {
      console.error("[Pipeline] Error processing accepted deals:", error)
    }
  }

  /**
   * Mark unresponsive leads as dead
   */
  private async cleanupStaleLeads(): Promise<void> {
    try {
      const timeoutHours = this.config.conversationTimeoutHours
      const timeoutDate = new Date()
      timeoutDate.setHours(timeoutDate.getHours() - timeoutHours)

      await prisma.vendorLead.updateMany({
        where: {
          pipelineStage: "AI_CONVERSATION" as PipelineStage,
          lastContactAt: {
            lt: timeoutDate,
          },
        },
        data: {
          pipelineStage: "DEAD_LEAD" as PipelineStage,
        },
      })
    } catch (error: any) {
      console.error("[Pipeline] Error cleaning up stale leads:", error)
    }
  }

  /**
   * Update daily pipeline metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Get or create today's metrics
      const existing = await prisma.pipelineMetric.findUnique({
        where: { date: today },
      })

      // Calculate metrics
      const stats = await this.calculateMetrics(today)

      if (existing) {
        await prisma.pipelineMetric.update({
          where: { id: existing.id },
          data: stats,
        })
      } else {
        await prisma.pipelineMetric.create({
          data: {
            date: today,
            ...stats,
          },
        })
      }
    } catch (error: any) {
      console.error("[Pipeline] Error updating metrics:", error)
    }
  }

  /**
   * Calculate pipeline metrics
   */
  private async calculateMetrics(date: Date): Promise<any> {
    // This would calculate various metrics from the database
    // For now, return placeholder structure
    return {
      newLeads: 0,
      inConversation: 0,
      validated: 0,
      offersMade: 0,
      offersAccepted: 0,
      offersRejected: 0,
      dealsClosed: 0,
      deadLeads: 0,
    }
  }
}

// Singleton instance
let pipelineServiceInstance: VendorPipelineService | null = null

export function getPipelineService(): VendorPipelineService {
  if (!pipelineServiceInstance) {
    pipelineServiceInstance = new VendorPipelineService()
  }
  return pipelineServiceInstance
}

