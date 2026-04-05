/**
 * Mock Twilio Service for Local Development
 * Simulates SMS sending/receiving without requiring Twilio credentials
 * Stores messages in memory for testing
 */

import { SMSDirection, SMSStatus } from "@prisma/client"
import { type MessageChannel, stripWhatsAppPrefix, detectChannel } from "./twilio"

export interface MockSMS {
  id: string
  messageSid: string
  to: string
  from: string
  body: string
  status: SMSStatus
  sentAt: Date
  deliveredAt?: Date
}

class MockTwilioService {
  private messages: Map<string, MockSMS> = new Map()
  private messageCounter = 0

  /**
   * Send SMS (mock - just stores in memory)
   */
  async sendSMS(to: string, message: string): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    return this._mockSend(to, message, "sms")
  }

  /**
   * Send WhatsApp (mock - same as SMS in mock mode)
   */
  async sendWhatsApp(to: string, message: string): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    return this._mockSend(to, message, "whatsapp")
  }

  /**
   * Unified send
   */
  async sendMessage(to: string, message: string, channel: MessageChannel = "sms"): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    return this._mockSend(to, message, channel)
  }

  private _mockSend(to: string, message: string, channel: MessageChannel): {
    messageSid: string
    status: SMSStatus
    error?: string
  } {
    this.messageCounter++
    const messageSid = `SM${Date.now()}${this.messageCounter}`
    const cleanTo = stripWhatsAppPrefix(to)

    const mockMessage: MockSMS = {
      id: messageSid,
      messageSid,
      to: cleanTo,
      from: process.env.TWILIO_PHONE_NUMBER || "+447700900000",
      body: message,
      status: "delivered" as SMSStatus,
      sentAt: new Date(),
      deliveredAt: new Date(),
    }

    this.messages.set(messageSid, mockMessage)

    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS"
    console.log(`[Mock Twilio] ${channelLabel} sent to ${cleanTo}:`, message)
    console.log(`[Mock Twilio] Message SID: ${messageSid}`)

    return {
      messageSid,
      status: "delivered" as SMSStatus,
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string): Promise<{
    status: SMSStatus
    deliveredAt?: Date
  }> {
    const message = this.messages.get(messageSid)
    if (!message) {
      return { status: "failed" as SMSStatus }
    }

    return {
      status: message.status,
      deliveredAt: message.deliveredAt,
    }
  }

  /**
   * Get all messages sent to a phone number (for testing)
   */
  getMessagesTo(phoneNumber: string): MockSMS[] {
    return Array.from(this.messages.values()).filter(
      msg => msg.to === phoneNumber
    )
  }

  /**
   * Get all messages from a phone number (for testing)
   */
  getMessagesFrom(phoneNumber: string): MockSMS[] {
    return Array.from(this.messages.values()).filter(
      msg => msg.from === phoneNumber
    )
  }

  /**
   * Simulate receiving an inbound SMS (helper method)
   * Note: This is just for convenience - use aiSMSAgent.processInboundMessage directly
   */
  async simulateInboundSMS(
    vendorLeadId: string,
    fromNumber: string,
    messageBody: string
  ): Promise<void> {
    // Import here to avoid circular dependencies
    const { aiSMSAgent } = await import("./ai-sms-agent")
    
    console.log(`[Mock Twilio] Simulating inbound SMS from ${fromNumber}:`, messageBody)
    
    // Process with AI agent
    await aiSMSAgent.processInboundMessage(vendorLeadId, messageBody, fromNumber)
  }

  /**
   * Validate webhook signature (always returns true in mock)
   */
  validateWebhookSignature(
    url: string,
    params: Record<string, string>,
    signature: string
  ): boolean {
    return true // Always valid in mock
  }

  /**
   * Parse inbound message (same as real Twilio).
   * Handles both SMS and WhatsApp (whatsapp: prefix).
   */
  parseInboundMessage(body: Record<string, any>): {
    messageSid: string
    fromNumber: string
    toNumber: string
    messageBody: string
    channel: MessageChannel
  } {
    const rawFrom = body.From || ""
    const rawTo   = body.To   || ""
    const channel = detectChannel(rawTo) || detectChannel(rawFrom)
    return {
      messageSid:  body.MessageSid || `SM${Date.now()}`,
      fromNumber:  stripWhatsAppPrefix(rawFrom),
      toNumber:    stripWhatsAppPrefix(rawTo),
      messageBody: body.Body || "",
      channel,
    }
  }

  /**
   * Clear all messages (for testing)
   */
  clearMessages(): void {
    this.messages.clear()
    this.messageCounter = 0
  }

  /**
   * Get all messages (for debugging)
   */
  getAllMessages(): MockSMS[] {
    return Array.from(this.messages.values())
  }
}

// Export singleton instance
export const mockTwilioService = new MockTwilioService()

// Export the mock service as the default when in development without Twilio
export function getTwilioService() {
  // Check if we should use mock (no Twilio credentials or explicit flag)
  const useMock = 
    !process.env.TWILIO_ACCOUNT_SID || 
    !process.env.TWILIO_AUTH_TOKEN ||
    process.env.USE_MOCK_TWILIO === "true"

  if (useMock) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Twilio] Using mock Twilio service (no credentials or USE_MOCK_TWILIO=true)")
    }
    return mockTwilioService
  }

  // Use real Twilio service
  console.log(`[Twilio] Using REAL Twilio — FROM number: ${process.env.TWILIO_PHONE_NUMBER || "⚠️ NOT SET"}`)
  try {
    const { twilioService } = require("./twilio")
    return twilioService
  } catch (error) {
    console.warn("[Twilio] Failed to load real Twilio service, falling back to mock")
    return mockTwilioService
  }
}

