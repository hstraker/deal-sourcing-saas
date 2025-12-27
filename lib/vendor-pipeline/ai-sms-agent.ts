/**
 * AI SMS Agent for Vendor Pipeline
 * Uses AI (OpenAI GPT-4 or Anthropic Claude) to conduct natural SMS conversations with vendors
 * Extracts property details and assesses motivation
 */

import { prisma } from "@/lib/db"
import { getTwilioService } from "./twilio-mock"
import { AIProviderService } from "./ai-provider"
import {
  AIConversationContext,
  AIConversationMessage,
  ConversationState,
} from "@/types/vendor-pipeline"
import { SMSDirection, PipelineStage, UrgencyLevel, PropertyCondition, ReasonForSale } from "@prisma/client"

const CONVERSATION_SYSTEM_PROMPT = `You are a property buyer's representative conducting SMS conversations with potential sellers. Be friendly, professional, warm, and concise.

YOUR GOALS:
1. Build rapport quickly
2. Extract: address (w/postcode), asking price, condition, reason for selling, timeline, competing offers
3. Assess motivation (1-10)
4. Keep natural - avoid interrogation

STRATEGY:
- SMS: 1-2 sentences max, <160 chars ideal
- ONE question at a time
- Acknowledge their info before next question
- Get address early, then condition, price, reason, timeline, competing offers
- If hesitant: "No obligation, just exploring options"
- Don't repeat questions

COMPLETE when you have: address, price, condition, reason, timeline (or after 8+ questions if vendor impatient)

MOTIVATION SCORING:
9-10: Urgent (<2 weeks), financial/divorce, no competition
7-8: Quick (<1 month), relocation/inheritance
5-6: Moderate (<3 months), downsize
3-4: Exploring, has viewings/offers
1-2: Casual, unlikely to proceed

RESPOND WITH JSON ONLY:
{
  "message": "Your SMS text",
  "intent": "question|providing_info|showing_interest|hesitation|objection|ready_to_proceed",
  "extractedData": {
    "propertyAddress": "address if mentioned",
    "askingPrice": number,
    "condition": "excellent|good|needs_work|needs_modernisation|poor",
    "reasonForSelling": "relocation|financial|divorce|inheritance|downsize|other",
    "timeline": "urgent|quick|moderate|flexible",
    "timelineDays": number,
    "competingOffers": boolean
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
   * Send initial message to a new vendor lead
   */
  async sendInitialMessage(vendorLeadId: string): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    const initialMessage = this.generateInitialMessage(lead.vendorName, lead.propertyAddress || "your property")

    // Send via Twilio (or mock)
    const twilioService = getTwilioService()
    const result = await twilioService.sendSMS(lead.vendorPhone, initialMessage)

    // Save to database
    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        messageSid: result.messageSid,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: lead.vendorPhone,
        messageBody: initialMessage,
        aiGenerated: true,
        status: result.status,
      },
    })

    // Update lead
    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        pipelineStage: "AI_CONVERSATION" as PipelineStage,
        conversationStartedAt: new Date(),
        lastContactAt: new Date(),
        conversationState: {
          conversationFlow: "initial",
          messagesExchanged: 1,
        },
      },
    })
  }

  /**
   * Process inbound message from vendor and generate AI response
   */
  async processInboundMessage(
    vendorLeadId: string,
    messageBody: string,
    fromNumber: string
  ): Promise<void> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    // Save inbound message
    const inboundMessage = await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "inbound" as SMSDirection,
        fromNumber,
        toNumber: process.env.TWILIO_PHONE_NUMBER,
        messageBody,
        aiGenerated: false,
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

    // Send AI response via Twilio (or mock)
    const twilioService = getTwilioService()
    const result = await twilioService.sendSMS(lead.vendorPhone, aiResponse.message)

    // Save AI response
    await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as SMSDirection,
        messageSid: result.messageSid,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: lead.vendorPhone,
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
   * Generate initial message template
   */
  private generateInitialMessage(vendorName: string, propertyAddress: string): string {
    return `Hi ${vendorName}! Thanks for your enquiry about selling ${propertyAddress}. We're cash buyers who can move quickly with no chain. What's your rough timeline for selling?`
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

