/**
 * Twilio SMS Integration for Vendor Pipeline
 * Handles sending and receiving SMS messages for AI conversations
 */

import { Twilio } from "twilio"
import { SMSMessageInput, SMSDirection } from "@/types/vendor-pipeline"
import { SMSStatus } from "@prisma/client"

export class TwilioService {
  private client: Twilio
  private fromNumber: string

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || ""

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN")
    }

    if (!this.fromNumber) {
      throw new Error("Twilio phone number not configured. Set TWILIO_PHONE_NUMBER")
    }

    this.client = new Twilio(accountSid, authToken)
  }

  /**
   * Send SMS message
   */
  async sendSMS(to: string, message: string): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
      })

      return {
        messageSid: result.sid,
        status: this.mapTwilioStatus(result.status as string),
      }
    } catch (error: any) {
      console.error("Error sending SMS:", error)
      return {
        messageSid: "",
        status: "failed" as SMSStatus,
        error: error.message,
      }
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string): Promise<{
    status: SMSStatus
    deliveredAt?: Date
  }> {
    try {
      const message = await this.client.messages(messageSid).fetch()
      return {
        status: this.mapTwilioStatus(message.status as string),
        deliveredAt: message.dateSent ? new Date(message.dateSent) : undefined,
      }
    } catch (error: any) {
      console.error("Error fetching message status:", error)
      return {
        status: "failed" as SMSStatus,
      }
    }
  }

  /**
   * Validate Twilio webhook signature
   */
  validateWebhookSignature(
    url: string,
    params: Record<string, string>,
    signature: string
  ): boolean {
    try {
      return this.client.validateRequest(
        process.env.TWILIO_AUTH_TOKEN || "",
        signature,
        url,
        params
      )
    } catch (error) {
      console.error("Error validating webhook signature:", error)
      return false
    }
  }

  /**
   * Parse inbound SMS from Twilio webhook
   */
  parseInboundMessage(body: Record<string, any>): {
    messageSid: string
    fromNumber: string
    toNumber: string
    messageBody: string
  } {
    return {
      messageSid: body.MessageSid || "",
      fromNumber: body.From || "",
      toNumber: body.To || "",
      messageBody: body.Body || "",
    }
  }

  /**
   * Map Twilio status to our SMSStatus enum
   */
  private mapTwilioStatus(twilioStatus: string): SMSStatus {
    const statusMap: Record<string, SMSStatus> = {
      queued: "queued",
      sending: "sent",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
    }

    return (statusMap[twilioStatus.toLowerCase()] || "failed") as SMSStatus
  }
}

export const twilioService = new TwilioService()

