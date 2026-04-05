/**
 * AI SMS Agent for Vendor Pipeline
 * Uses AI (OpenAI GPT-4 or Anthropic Claude) to conduct natural SMS conversations with vendors
 * Extracts property details and assesses motivation
 */

import { prisma } from "@/lib/db"
import { getTwilioService } from "./twilio-mock"
import type { MessageChannel } from "./twilio"
import { AIProviderService } from "./ai-provider"
import {
  AIConversationContext,
  AIConversationMessage,
  ConversationState,
} from "@/types/vendor-pipeline"
import { SMSDirection, PipelineStage, UrgencyLevel, PropertyCondition, ReasonForSale } from "@prisma/client"

const CONVERSATION_SYSTEM_PROMPT = `You are a property buyer's representative at a cash buying company, conducting SMS conversations with potential sellers in the UK. Be warm, friendly, and professional — like a helpful advisor, not a salesperson.

YOUR GOALS:
1. Build rapport quickly and make the vendor feel heard
2. Naturally extract: full address (with postcode), asking price, property condition, reason for selling, timeline, and whether they have competing offers
3. Assess the vendor's motivation (1-10 score)
4. Guide the conversation to completion in a natural, human way

STRATEGY:
- Keep messages to 2-3 sentences — natural SMS length, not robotic
- Ask ONE question at a time, never a list of questions
- Always acknowledge what they've shared before moving to the next topic
- Use conversational language: contractions, warmth, occasional light humour
- Order: reason for selling → timeline → address/postcode → condition → price → competing offers
- If they seem hesitant: "No pressure at all, we're just exploring what might work for you"
- If they ask about price first: explain you need to see the property details before making an offer
- Never repeat a question you've already asked
- Mirror their energy — if they're brief, be brief; if they're chatty, be warmer

COMPLETE when you have: address, price, condition, reason, timeline. Or after 10+ exchanges if vendor is clearly disengaged.

MOTIVATION SCORING:
9-10: Urgent (< 2 weeks), financial distress / divorce / bereavement, no competing offers
7-8: Quick sale wanted (< 1 month), relocation / inheritance, open to below market offers
5-6: Moderate (< 3 months), downsizing / lifestyle change, considering options
3-4: Exploring market, has estate agent viewings or other offers
1-2: Casual enquiry, not ready to sell or expects full market value only

RESPOND WITH VALID JSON ONLY — no markdown, no explanation, just the JSON object:
{
  "message": "Your natural SMS reply here",
  "intent": "question|providing_info|showing_interest|hesitation|objection|ready_to_proceed",
  "extractedData": {
    "propertyAddress": "full address with postcode if mentioned",
    "askingPrice": number or null,
    "condition": "excellent|good|needs_work|needs_modernisation|poor",
    "reasonForSelling": "relocation|financial|divorce|inheritance|downsize|other",
    "timeline": "urgent|quick|moderate|flexible",
    "timelineDays": number or null,
    "competingOffers": boolean or null
  },
  "motivationScore": 1-10,
  "conversationQuality": 1-10,
  "conversationComplete": boolean,
  "nextQuestionType": "address|price|condition|reason|timeline|competing_offers|wrap_up|none"
}`

export class AISMSAgent {
  private aiProvider: AIProviderService

  constructor() {
    this.aiProvider = new AIProviderService()
  }

  /**
   * Normalise a UK phone number to E.164 format so Twilio accepts it.
   * e.g. 07595354573 → +447595354573
   */
  private normalisePhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "")
    if (/^07\d{9}$/.test(cleaned))  return "+44" + cleaned.slice(1)
    if (/^447\d{9}$/.test(cleaned)) return "+" + cleaned
    if (/^\+\d{10,15}$/.test(cleaned)) return cleaned
    return cleaned // return as-is; Twilio will give a clear error
  }

  /**
   * Send initial message to a new vendor lead
   * @param channel "sms" (default) or "whatsapp"
   */
  async sendInitialMessage(vendorLeadId: string, channel: MessageChannel = "sms"): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    // Normalise phone to E.164 — catches numbers stored as 07xxx instead of +447xxx
    const toNumber = this.normalisePhone(lead.vendorPhone)
    if (toNumber !== lead.vendorPhone) {
      console.log(`[AISMSAgent] Normalised phone ${lead.vendorPhone} → ${toNumber}`)
      await prisma.vendorLead.update({ where: { id: lead.id }, data: { vendorPhone: toNumber } })
    }

    const initialMessage = this.generateInitialMessage(lead.vendorName, lead.propertyAddress || "your property")

    // Send via Twilio (or mock) on the right channel
    const twilioService = getTwilioService()
    const result = await twilioService.sendMessage(toNumber, initialMessage, channel)

    // Surface Twilio errors — do NOT silently continue with a failed status
    if (result.error) {
      throw new Error(`${channel === "whatsapp" ? "WhatsApp" : "SMS"} delivery failed: ${result.error}`)
    }

    const fromNumber = channel === "whatsapp"
      ? (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || undefined)
      : (process.env.TWILIO_PHONE_NUMBER || undefined)

    // Save to database
    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        messageSid: result.messageSid || undefined,
        fromNumber,
        toNumber: toNumber,
        messageBody: initialMessage,
        aiGenerated: true,
        status: result.status,
        channel,
      },
    })

    // Update lead with preferred channel
    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        pipelineStage: "AI_CONVERSATION" as PipelineStage,
        conversationStartedAt: new Date(),
        lastContactAt: new Date(),
        preferredChannel: channel,
        conversationState: {
          conversationFlow: "initial",
          messagesExchanged: 1,
        },
      },
    })
  }

  /**
   * Process inbound message from vendor and generate AI response
   * @param channel "sms" (default) or "whatsapp" — use the channel the vendor replied on
   */
  async processInboundMessage(
    vendorLeadId: string,
    messageBody: string,
    fromNumber: string,
    channel: MessageChannel = "sms"
  ): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    const ourNumber = channel === "whatsapp"
      ? (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || undefined)
      : (process.env.TWILIO_PHONE_NUMBER || undefined)

    // Save inbound message
    const inboundMessage = await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "inbound" as SMSDirection,
        fromNumber,
        toNumber: ourNumber,
        messageBody,
        aiGenerated: false,
        channel,
      },
    })

    // Get conversation history - LIMIT TO LAST 6 MESSAGES to save tokens
    const messages = await prisma.sMSMessage.findMany({
      where: { vendorLeadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 6, // Only last 6 messages to reduce cost
    })
    messages.reverse() // Put back in chronological order

    // Build conversation context
    const conversationHistory: AIConversationMessage[] = messages.map(msg => ({
      role: msg.direction === "inbound" ? "user" : "assistant",
      content: msg.messageBody,
      timestamp: msg.createdAt,
    }))

    const existingState = (lead.conversationState || {}) as ConversationState
    const context: AIConversationContext = {
      vendorName: lead.vendorName,
      propertyAddress: lead.propertyAddress || undefined,
      conversationHistory,
      extractedData: existingState.extractedData || {},
    }

    // Generate AI response
    const startTime = Date.now()
    const aiResponse = await this.generateAIResponse(context, messageBody)
    const responseTime = Date.now() - startTime

    // Send AI response via Twilio (or mock) — reply on same channel vendor used
    const twilioService = getTwilioService()
    const result = await twilioService.sendMessage(lead.vendorPhone, aiResponse.message, channel)

    const replyFrom = channel === "whatsapp"
      ? (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || undefined)
      : (process.env.TWILIO_PHONE_NUMBER || undefined)

    // Save AI response
    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        messageSid: result.messageSid || undefined,
        fromNumber: replyFrom,
        toNumber: lead.vendorPhone,
        channel,
        messageBody: aiResponse.message,
        aiGenerated: true,
        aiPrompt: JSON.stringify(context),
        aiResponseMetadata: {
          model: this.aiProvider.getModel(),
          provider: this.aiProvider.getProvider(),
          responseTime,
          tokens: aiResponse.tokens,
          intent: aiResponse.intent,
          conversationQuality: aiResponse.conversationQuality,
          nextQuestionType: aiResponse.nextQuestionType,
          rateLimitInfo: aiResponse.rateLimitInfo,
        },
        intentDetected: aiResponse.intent,
        confidenceScore: aiResponse.conversationQuality ? aiResponse.conversationQuality / 10 : undefined,
        status: result.status,
      },
    })

    // Validate extracted data
    const validation = aiResponse.extractedData
      ? this.validateExtractedData(aiResponse.extractedData)
      : { isValid: true, errors: [] }

    if (!validation.isValid) {
      console.warn(`[AI SMS Agent] Data validation issues for lead ${lead.id}:`, validation.errors)
    }

    // Update conversation state and lead
    const updatedState: ConversationState = {
      ...existingState,
      extractedData: {
        ...existingState.extractedData,
        // Only merge valid data
        ...(validation.isValid ? aiResponse.extractedData : {}),
      },
      conversationFlow: aiResponse.conversationComplete ? "offer_pending" : "extracting_details",
      messagesExchanged: messages.length + 2,
      conversationComplete: aiResponse.conversationComplete,
      lastIntent: aiResponse.intent,
      lastConversationQuality: aiResponse.conversationQuality,
      nextQuestionType: aiResponse.nextQuestionType,
      validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
    }

    const updateData: any = {
      conversationState: updatedState,
      lastContactAt: new Date(),
      motivationScore: aiResponse.motivationScore || lead.motivationScore,
    }

    // Update extracted data fields if present and valid
    if (aiResponse.extractedData && validation.isValid) {
      if (aiResponse.extractedData.propertyAddress) {
        updateData.propertyAddress = aiResponse.extractedData.propertyAddress
      }
      if (aiResponse.extractedData.askingPrice) {
        updateData.askingPrice = aiResponse.extractedData.askingPrice
      }
      if (aiResponse.extractedData.condition) {
        updateData.condition = aiResponse.extractedData.condition
      }
      if (aiResponse.extractedData.reasonForSelling) {
        updateData.reasonForSelling = aiResponse.extractedData.reasonForSelling
      }
      if (aiResponse.extractedData.timeline) {
        updateData.urgencyLevel = aiResponse.extractedData.timeline
      }
      if (aiResponse.extractedData.timelineDays) {
        updateData.timelineDays = aiResponse.extractedData.timelineDays
      }
      if (typeof aiResponse.extractedData.competingOffers === 'boolean') {
        updateData.competingOffers = aiResponse.extractedData.competingOffers
      }
    }

    // If conversation is complete, move to validation
    if (aiResponse.conversationComplete) {
      updateData.pipelineStage = "DEAL_VALIDATION" as PipelineStage
    }

    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: updateData,
    })
  }

  /**
   * Generate AI response using AI provider (OpenAI or Anthropic)
   */
  private async generateAIResponse(
    context: AIConversationContext,
    latestMessage: string
  ): Promise<{
    message: string
    extractedData?: Partial<ConversationState["extractedData"]>
    motivationScore?: number
    conversationComplete: boolean
    tokens?: number
    intent?: "question" | "providing_info" | "showing_interest" | "hesitation" | "objection" | "ready_to_proceed"
    conversationQuality?: number
    nextQuestionType?: "address" | "price" | "condition" | "reason" | "timeline" | "competing_offers" | "wrap_up" | "none"
    rateLimitInfo?: any
  }> {
    try {
      // Build system prompt - conversation history sent as messages, not duplicated here
      const systemPrompt = `${CONVERSATION_SYSTEM_PROMPT}

Context:
Vendor: ${context.vendorName}
Property: ${context.propertyAddress || "Not specified"}
Data: ${JSON.stringify(context.extractedData)}`

      // Build conversation messages
      const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
        ...context.conversationHistory.map(msg => ({
          role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: msg.content,
        })),
        {
          role: "user" as const,
          content: latestMessage,
        },
      ]

      // Get AI response with JSON format
      const completion = await this.aiProvider.chat(
        messages,
        systemPrompt,
        { type: "json_object" }
      )

      // Parse JSON response
      let responseData: any = {}
      try {
        responseData = JSON.parse(completion.message)
      } catch (parseError) {
        console.error("Error parsing AI JSON response:", parseError)
        console.error("Raw response:", completion.message)
        // Try to extract JSON from response
        const jsonMatch = completion.message.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          responseData = JSON.parse(jsonMatch[0])
        }
      }

      return {
        message: responseData.message || "Thank you for your interest. We'll be in touch soon.",
        extractedData: responseData.extractedData,
        motivationScore: responseData.motivationScore,
        conversationComplete: responseData.conversationComplete || false,
        tokens: completion.tokens,
        intent: responseData.intent,
        conversationQuality: responseData.conversationQuality,
        nextQuestionType: responseData.nextQuestionType,
      }
    } catch (error: any) {
      console.error("Error generating AI response:", error)
      // Fallback response
      return {
        message: "Thank you for your message. Could you tell me more about your property?",
        conversationComplete: false,
      }
    }
  }

  /**
   * Generate the opening message to the vendor.
   * Warm, natural, and personal — no restrictions now we're on a paid Twilio account.
   */
  private generateInitialMessage(vendorName: string, propertyAddress: string): string {
    const firstName = vendorName.split(" ")[0]
    // If we have an address, reference it; otherwise keep it generic
    if (propertyAddress && propertyAddress !== "your property") {
      return `Hi ${firstName}, thanks for reaching out about your property on ${propertyAddress}. We specialise in fast, hassle-free sales - no viewings, no chains. What's prompting the move?`
    }
    return `Hi ${firstName}, thanks for reaching out. We specialise in fast, hassle-free property sales - no viewings, no chains, and we can move as quickly as you need. What's prompting the sale?`
  }

  /**
   * Validate extracted data for sanity
   */
  private validateExtractedData(data: any): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Validate asking price
    if (data.askingPrice) {
      const price = Number(data.askingPrice)
      if (isNaN(price) || price < 10000 || price > 10000000) {
        errors.push(`Invalid asking price: £${data.askingPrice}`)
      }
    }

    // Validate timeline days
    if (data.timelineDays) {
      const days = Number(data.timelineDays)
      if (isNaN(days) || days < 1 || days > 730) {
        errors.push(`Invalid timeline: ${data.timelineDays} days`)
      }
    }

    // Validate condition enum
    if (data.condition) {
      const validConditions = ["excellent", "good", "needs_work", "needs_modernisation", "poor"]
      if (!validConditions.includes(data.condition)) {
        errors.push(`Invalid condition: ${data.condition}`)
      }
    }

    // Validate reason enum
    if (data.reasonForSelling) {
      const validReasons = ["relocation", "financial", "divorce", "inheritance", "downsize", "other"]
      if (!validReasons.includes(data.reasonForSelling)) {
        errors.push(`Invalid reason: ${data.reasonForSelling}`)
      }
    }

    // Validate timeline enum
    if (data.timeline) {
      const validTimelines = ["urgent", "quick", "moderate", "flexible"]
      if (!validTimelines.includes(data.timeline)) {
        errors.push(`Invalid timeline: ${data.timeline}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calculate motivation score from conversation data
   */
  calculateMotivationScore(
    urgencyLevel?: UrgencyLevel,
    reasonForSelling?: ReasonForSale,
    competingOffers?: boolean,
    timelineDays?: number
  ): number {
    let score = 5 // Base score

    // Urgency scoring
    switch (urgencyLevel) {
      case UrgencyLevel.urgent:
        score += 3
        break
      case UrgencyLevel.quick:
        score += 2
        break
      case UrgencyLevel.moderate:
        score += 1
        break
    }

    // Reason for selling scoring
    switch (reasonForSelling) {
      case ReasonForSale.financial:
      case ReasonForSale.divorce:
        score += 3
        break
      case ReasonForSale.relocation:
      case ReasonForSale.inheritance:
        score += 2
        break
      case ReasonForSale.downsize:
        score += 1
        break
    }

    // Competing offers penalty
    if (competingOffers) {
      score -= 2
    }

    // Timeline bonus (shorter = more motivated)
    if (timelineDays) {
      if (timelineDays <= 14) {
        score += 2
      } else if (timelineDays <= 30) {
        score += 1
      }
    }

    // Clamp between 1 and 10
    return Math.max(1, Math.min(10, score))
  }
}

export const aiSMSAgent = new AISMSAgent()

