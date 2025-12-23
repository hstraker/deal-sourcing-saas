/**
 * Mock Twilio Service for Local Development
 * Simulates SMS sending/receiving without requiring Twilio credentials
 * Stores messages in memory for testing
 */

import { SMSDirection } from "@/types/vendor-pipeline"
import { SMSStatus } from "@prisma/client"

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
    this.messageCounter++
    const messageSid = `SM${Date.now()}${this.messageCounter}`
    
    const mockMessage: MockSMS = {
      id: messageSid,
      messageSid,
      to,
      from: process.env.TWILIO_PHONE_NUMBER || "+447700900000",
      body: message,
      status: "delivered" as SMSStatus, // Immediately "delivered" in mock
      sentAt: new Date(),
      deliveredAt: new Date(),
    }

    this.messages.set(messageSid, mockMessage)
    
    console.log(`[Mock Twilio] SMS sent to ${to}:`, message)
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
   * Parse inbound message (same as real Twilio)
   */
  parseInboundMessage(body: Record<string, any>): {
    messageSid: string
    fromNumber: string
    toNumber: string
    messageBody: string
  } {
    return {
      messageSid: body.MessageSid || `SM${Date.now()}`,
      fromNumber: body.From || "",
      toNumber: body.To || "",
      messageBody: body.Body || "",
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
  try {
    const { twilioService } = require("./twilio")
    return twilioService
  } catch (error) {
    console.warn("[Twilio] Failed to load real Twilio service, falling back to mock")
    return mockTwilioService
  }
}

