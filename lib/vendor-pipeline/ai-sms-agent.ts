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
  UrgencyLevel,
  PropertyCondition,
  ReasonForSale,
} from "@/types/vendor-pipeline"
import { SMSDirection, PipelineStage } from "@prisma/client"

const CONVERSATION_SYSTEM_PROMPT = `You are a professional property acquisition specialist having an SMS conversation with a potential seller.

Your goals:
1. Build rapport and trust quickly
2. Extract: property address, asking price, condition, reason for selling, timeline
3. Assess motivation level (1-10)
4. Keep messages short (1-2 sentences max for SMS - under 160 characters when possible)
5. Sound natural and empathetic, not robotic

Conversation guidelines:
- Be friendly but professional
- Show empathy for their situation
- Don't push too hard - let them open up naturally
- If they seem hesitant, reassure them (no obligation, just exploring options)
- Extract information gradually over 5-8 messages
- Once you have all key info, wrap up politely

IMPORTANT: You must respond with valid JSON only. Format your response as:
{
  "message": "Your SMS message text",
  "extractedData": {
    "propertyAddress": "address if mentioned",
    "askingPrice": number if mentioned,
    "condition": "excellent|good|needs_work|needs_modernisation|poor",
    "reasonForSelling": "relocation|financial|divorce|inheritance|downsize|other",
    "timeline": "urgent|quick|moderate|flexible",
    "timelineDays": number if timeline given,
    "competingOffers": boolean
  },
  "motivationScore": number 1-10,
  "conversationComplete": boolean
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

    // Get conversation history
    const messages = await prisma.sMSMessage.findMany({
      where: { vendorLeadId: lead.id },
      orderBy: { createdAt: "asc" },
    })

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
        },
        status: result.status,
      },
    })

    // Update conversation state and lead
    const updatedState: ConversationState = {
      ...existingState,
      extractedData: {
        ...existingState.extractedData,
        ...aiResponse.extractedData,
      },
      conversationFlow: aiResponse.conversationComplete ? "offer_pending" : "extracting_details",
      messagesExchanged: messages.length + 2,
      conversationComplete: aiResponse.conversationComplete,
    }

    const updateData: any = {
      conversationState: updatedState,
      lastContactAt: new Date(),
      motivationScore: aiResponse.motivationScore || lead.motivationScore,
    }

    // Update extracted data fields if present
    if (aiResponse.extractedData) {
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
      if (aiResponse.extractedData.competingOffers !== undefined) {
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
  }> {
    try {
      // Build system prompt with context embedded
      const systemPrompt = `${CONVERSATION_SYSTEM_PROMPT}

Current conversation context:
Vendor: ${context.vendorName}
Property: ${context.propertyAddress || "Not yet specified"}
Extracted data so far: ${JSON.stringify(context.extractedData, null, 2)}

Conversation history (${context.conversationHistory.length} messages):
${context.conversationHistory.map((msg, i) => `${i + 1}. ${msg.role === "user" ? "Vendor" : "You"}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`).join("\n")}

Latest vendor message: ${latestMessage}`

      // Build conversation messages
      const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
        ...context.conversationHistory.map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        })),
        {
          role: "user",
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

