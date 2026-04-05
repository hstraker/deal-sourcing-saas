/**
 * Twilio SMS + WhatsApp Integration for Vendor Pipeline
 * Handles sending and receiving SMS and WhatsApp messages for AI conversations
 */

import { Twilio } from "twilio"
import { validateRequest } from "twilio"
import { SMSMessageInput } from "@/types/vendor-pipeline"
import { SMSDirection, SMSStatus } from "@prisma/client"

export type MessageChannel = "sms" | "whatsapp"

/** Format a E.164 phone number for WhatsApp (adds whatsapp: prefix) */
function toWhatsAppAddress(phone: string): string {
  const cleaned = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`
  return cleaned
}

/** Strip whatsapp: prefix from a number, returning bare E.164 */
export function stripWhatsAppPrefix(phone: string): string {
  return phone.replace(/^whatsapp:/i, "")
}

/** Detect channel from a Twilio `To` or `From` field value */
export function detectChannel(address: string): MessageChannel {
  return address.toLowerCase().startsWith("whatsapp:") ? "whatsapp" : "sms"
}

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
    return this._send(to, message, "sms")
  }

  /**
   * Send WhatsApp message
   * Requires TWILIO_WHATSAPP_NUMBER env var (e.g. +14155238886 for sandbox,
   * or your approved WhatsApp Business number).
   * First outbound message to a new contact should use a pre-approved template.
   */
  async sendWhatsApp(to: string, message: string): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    return this._send(to, message, "whatsapp")
  }

  /**
   * Unified send — picks channel automatically
   */
  async sendMessage(to: string, message: string, channel: MessageChannel = "sms"): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    return this._send(to, message, channel)
  }

  private async _send(to: string, message: string, channel: MessageChannel): Promise<{
    messageSid: string
    status: SMSStatus
    error?: string
  }> {
    try {
      let fromNumber: string
      let toAddress: string

      if (channel === "whatsapp") {
        const waNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || this.fromNumber
        fromNumber = toWhatsAppAddress(waNumber)
        toAddress  = toWhatsAppAddress(stripWhatsAppPrefix(to))
        console.log(`[Twilio] Sending WhatsApp from ${fromNumber} to ${toAddress}`)
      } else {
        fromNumber = process.env.TWILIO_PHONE_NUMBER || this.fromNumber
        toAddress  = stripWhatsAppPrefix(to) // ensure no stray prefix
        console.log(`[Twilio] Sending SMS from ${fromNumber} to ${toAddress}`)
      }

      if (!fromNumber) {
        return { messageSid: "", status: "failed" as SMSStatus, error: "From number not configured" }
      }

      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: toAddress,
      })

      return {
        messageSid: result.sid,
        status: this.mapTwilioStatus(result.status as string),
      }
    } catch (error: any) {
      console.error(`[Twilio] Error sending ${channel} message:`, error)
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
      return validateRequest(
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
   * Parse inbound message from Twilio webhook.
   * Handles both SMS (plain E.164) and WhatsApp (whatsapp:+44xxx prefixed) addresses.
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
      messageSid:  body.MessageSid || "",
      fromNumber:  stripWhatsAppPrefix(rawFrom),
      toNumber:    stripWhatsAppPrefix(rawTo),
      messageBody: body.Body || "",
      channel,
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
