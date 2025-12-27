/**
 * Offer Engine for Vendor Pipeline
 * Calculates and manages property acquisition offers
 */

import { prisma } from "@/lib/db"
import { getTwilioService } from "./twilio-mock"
import { aiSMSAgent } from "./ai-sms-agent"
import {
  OfferCalculationInput,
  OfferCalculationResult,
} from "@/types/vendor-pipeline"
import { SMSDirection, PipelineStage, PropertyCondition } from "@prisma/client"
import { getPipelineConfig } from "./config"
import { getRetryDelayDays } from "@/types/vendor-pipeline"

export class OfferEngine {
  private config = getPipelineConfig()

  /**
   * Calculate offer amount for a vendor lead
   */
  calculateOffer(vendorLeadId: string): Promise<OfferCalculationResult> {
    return this.calculateOfferFromLead(vendorLeadId)
  }

  /**
   * Calculate offer from vendor lead data
   */
  private async calculateOfferFromLead(vendorLeadId: string): Promise<OfferCalculationResult> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    if (!lead.estimatedMarketValue || !lead.askingPrice) {
      throw new Error("Missing market value or asking price for offer calculation")
    }

    const input: OfferCalculationInput = {
      askingPrice: Number(lead.askingPrice),
      marketValue: Number(lead.estimatedMarketValue),
      condition: lead.condition || undefined,
      motivationScore: lead.motivationScore || undefined,
      estimatedRefurbCost: lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : undefined,
    }

    return this.calculateOfferAmount(input)
  }

  /**
   * Calculate offer amount based on multiple factors with sophisticated pricing strategy
   */
  private calculateOfferAmount(input: OfferCalculationInput): OfferCalculationResult {
    // 1. Base offer: 80% of market value (configurable)
    const baseOffer = input.marketValue * (this.config.offerBasePercentage / 100)

    // 2. Condition adjustment: subtract estimated renovation costs
    const conditionAdjustment = -(input.estimatedRefurbCost || 0)

    // 3. Motivation-based pricing strategy
    let motivationBonus = 0
    if (input.motivationScore) {
      if (input.motivationScore >= 9) {
        // Highly motivated: up to £10k bonus (be competitive)
        motivationBonus = 10000
      } else if (input.motivationScore >= 7) {
        // Motivated: up to £7k bonus
        motivationBonus = 7000
      } else if (input.motivationScore >= 5) {
        // Moderately motivated: up to £3k bonus
        motivationBonus = 3000
      } else {
        // Low motivation: minimal bonus (£1k)
        motivationBonus = 1000
      }
    }

    // 4. Deal attractiveness multiplier
    // Better deals (higher BMV) get slightly higher offers to secure them
    const askingToMarketRatio = input.askingPrice / input.marketValue
    let attractivenessBonus = 0

    if (askingToMarketRatio <= 0.75) {
      // Excellent deal (25%+ BMV) - be more aggressive
      attractivenessBonus = 5000
    } else if (askingToMarketRatio <= 0.85) {
      // Good deal (15%+ BMV) - moderate bonus
      attractivenessBonus = 2000
    }

    // 5. Calculate provisional offer
    let provisionalOffer = baseOffer + conditionAdjustment + motivationBonus + attractivenessBonus

    // 6. Apply strategic caps and floors

    // Cap: Never exceed 85% of asking price (configurable)
    const maxOfferPercentage = input.askingPrice * (this.config.offerMaxPercentage / 100)
    provisionalOffer = Math.min(provisionalOffer, maxOfferPercentage)

    // Cap: Never exceed asking price
    provisionalOffer = Math.min(provisionalOffer, input.askingPrice)

    // Floor: Minimum profit margin check
    // Ensure at least £30k profit after all costs
    const minimumProfitRequired = 30000
    const estimatedTotalCosts = provisionalOffer + (input.estimatedRefurbCost || 0) + (provisionalOffer * 0.05) // 5% transaction costs
    const potentialProfit = input.marketValue - estimatedTotalCosts

    if (potentialProfit < minimumProfitRequired) {
      // Adjust offer down to maintain minimum profit
      const maxAffordableOffer = input.marketValue - minimumProfitRequired - (input.estimatedRefurbCost || 0) - (provisionalOffer * 0.05)
      provisionalOffer = Math.min(provisionalOffer, maxAffordableOffer)
    }

    // Ensure offer is positive and reasonable
    const finalOffer = Math.max(provisionalOffer, 0)

    // Round to nearest £1000 for cleaner offers
    const roundedOffer = Math.round(finalOffer / 1000) * 1000

    return {
      offerAmount: Math.round(roundedOffer),
      offerPercentage: (roundedOffer / input.askingPrice) * 100,
      offerPercentageOfMarket: (roundedOffer / input.marketValue) * 100,
      calculationBreakdown: {
        baseOffer: Math.round(baseOffer),
        conditionAdjustment: Math.round(conditionAdjustment),
        motivationBonus: Math.round(motivationBonus),
        attractivenessBonus: Math.round(attractivenessBonus),
        provisionalOffer: Math.round(provisionalOffer),
        finalOffer: Math.round(roundedOffer),
      },
    }
  }

  /**
   * Send offer to vendor via SMS
   */
  async sendOffer(vendorLeadId: string): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    // Calculate offer if not already calculated
    let offerAmount = lead.offerAmount ? Number(lead.offerAmount) : null
    if (!offerAmount) {
      const calculation = await this.calculateOfferFromLead(vendorLeadId)
      offerAmount = calculation.offerAmount
    }

    // Generate offer message
    const timelineDays = lead.timelineDays || 14
    const message = this.generateOfferMessage(
      lead.vendorName,
      lead.propertyAddress || "your property",
      offerAmount!,
      timelineDays
    )

    // Send via Twilio (or mock)
    const twilioService = getTwilioService()
    const result = await twilioService.sendSMS(lead.vendorPhone, message)

    // Save SMS message
    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        messageSid: result.messageSid,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: lead.vendorPhone,
        messageBody: message,
        aiGenerated: false,
        status: result.status,
      },
    })

    // Update lead
    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        pipelineStage: "OFFER_MADE" as PipelineStage,
        offerAmount,
        offerPercentage: (offerAmount! / Number(lead.askingPrice)) * 100,
        offerSentAt: new Date(),
        lastContactAt: new Date(),
      },
    })
  }

  /**
   * Handle offer acceptance
   */
  async handleOfferAcceptance(vendorLeadId: string): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        pipelineStage: "OFFER_ACCEPTED" as PipelineStage,
        offerAcceptedAt: new Date(),
        lastContactAt: new Date(),
      },
    })

    // Request solicitor details
    const message = `Great! We're excited to move forward. Could you please provide your solicitor's details (name, firm, email, phone) so we can send over the paperwork?`
    
    const twilioService = getTwilioService()
    await twilioService.sendSMS(lead.vendorPhone, message)
    
    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: lead.vendorPhone,
        messageBody: message,
        aiGenerated: false,
      },
    })
  }

  /**
   * Handle offer rejection
   */
  async handleOfferRejection(vendorLeadId: string, reason?: string): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    // Send objection-handling video
    const videoUrl = process.env.VIDEO_OBJECTION_URL || ""
    const message = videoUrl
      ? `I understand. We have a helpful video that addresses common concerns: ${videoUrl}. We'll follow up in a couple of days.`
      : `I understand. We'll follow up in a couple of days to see if your situation has changed.`

    const twilioService = getTwilioService()
    await twilioService.sendSMS(lead.vendorPhone, message)

    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: lead.vendorPhone,
        messageBody: message,
        aiGenerated: false,
      },
    })

    // Schedule first retry
    const retryDelayDays = getRetryDelayDays(lead.retryCount) || 2
    const nextRetryAt = new Date()
    nextRetryAt.setDate(nextRetryAt.getDate() + retryDelayDays)

    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        pipelineStage: "VIDEO_SENT" as PipelineStage,
        offerRejectedAt: new Date(),
        rejectionReason: reason,
        videoSent: true,
        videoUrl: videoUrl || undefined,
        nextRetryAt,
        lastContactAt: new Date(),
      },
    })
  }

  /**
   * Send retry message
   */
  async sendRetry(vendorLeadId: string, retryNumber: 1 | 2 | 3): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    const message = this.generateRetryMessage(
      lead.vendorName,
      lead.propertyAddress || "your property",
      lead.offerAmount ? Number(lead.offerAmount) : 0,
      retryNumber
    )

    const twilioService = getTwilioService()
    const result = await twilioService.sendSMS(lead.vendorPhone, message)

    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        messageSid: result.messageSid,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: lead.vendorPhone,
        messageBody: message,
        aiGenerated: false,
        status: result.status,
      },
    })

    // Schedule next retry if applicable
    let nextRetryAt: Date | null = null
    let nextStage: PipelineStage = "DEAD_LEAD" as PipelineStage

    if (retryNumber < 3) {
      const delayDays = getRetryDelayDays(retryNumber) || 2
      nextRetryAt = new Date()
      nextRetryAt.setDate(nextRetryAt.getDate() + delayDays)
      nextStage = retryNumber === 1 ? ("RETRY_1" as PipelineStage) : ("RETRY_2" as PipelineStage)
    }

    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        pipelineStage: nextStage,
        retryCount: retryNumber,
        nextRetryAt,
        lastContactAt: new Date(),
      },
    })
  }

  /**
   * Generate offer message
   */
  private generateOfferMessage(
    vendorName: string,
    propertyAddress: string,
    offerAmount: number,
    timelineDays: number
  ): string {
    return `Hi ${vendorName}, based on our assessment of ${propertyAddress}, we can offer £${offerAmount.toLocaleString()} for a quick cash sale (completion in ${timelineDays} days). This reflects the current condition and allows us to move quickly. Interested in discussing?`
  }

  /**
   * Generate retry message
   */
  private generateRetryMessage(
    vendorName: string,
    propertyAddress: string,
    offerAmount: number,
    retryNumber: 1 | 2 | 3
  ): string {
    switch (retryNumber) {
      case 1:
        return `Hi ${vendorName}, just checking if you've had time to consider our offer of £${offerAmount.toLocaleString()} for ${propertyAddress}? We can complete quickly with no chain.`
      case 2:
        return `Hi ${vendorName}, we can be flexible on price/timeline. Would £${offerAmount.toLocaleString()} work better for you? Let me know your thoughts.`
      case 3:
        const deadline = new Date()
        deadline.setDate(deadline.getDate() + 3)
        return `Hi ${vendorName}, this is our final offer of £${offerAmount.toLocaleString()}. We have other opportunities, so please let us know by ${deadline.toLocaleDateString()} if you're interested.`
      default:
        return `Hi ${vendorName}, following up on our offer for ${propertyAddress}.`
    }
  }
}

export const offerEngine = new OfferEngine()

