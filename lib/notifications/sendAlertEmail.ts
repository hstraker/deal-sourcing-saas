import nodemailer from "nodemailer"
import type { EmailResult } from "@/lib/email"

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

function getTransporter() {
  if (!isSmtpConfigured()) return null
  const port = parseInt(process.env.SMTP_PORT || "465")
  const secure = port === 465
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
}

function fromAddress(): string {
  const name = process.env.SMTP_FROM_NAME || process.env.SMTP_USER || "DealStack"
  const addr = process.env.SMTP_USER || "noreply@dealstack.co.uk"
  return `"${name}" <${addr}>`
}

export interface AlertEmailPayload {
  toEmail: string
  alertName: string
  address: string
  price: number
  bedrooms: number | null
  propertyType: string | null
  listingUrl: string | null
}

export async function sendAlertMatchEmail(payload: AlertEmailPayload): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }

  const appUrl = process.env.APP_URL || "http://localhost:3000"
  const priceFormatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(payload.price)
  const bedsText = payload.bedrooms ? `${payload.bedrooms} bed` : ""
  const typeText = payload.propertyType || ""
  const subtitle = [bedsText, typeText].filter(Boolean).join(" ")

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to: payload.toEmail,
      subject: `New alert match: ${payload.alertName} — ${priceFormatted}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">New Property Match</h2>
          <p style="margin: 0 0 16px; color: #555;">Your sourcing alert <strong>${payload.alertName}</strong> has a new match.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb;">
            <p style="font-size: 18px; font-weight: 700; margin: 0 0 4px;">${priceFormatted}</p>
            ${subtitle ? `<p style="color: #6b7280; margin: 0 0 8px; font-size: 14px;">${subtitle}</p>` : ""}
            <p style="margin: 0 0 12px;">${payload.address}</p>
            ${payload.listingUrl ? `<a href="${payload.listingUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Listing</a>` : ""}
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
            Manage your alerts at <a href="${appUrl}/dashboard/sourcing-alerts">${appUrl}/dashboard/sourcing-alerts</a>
          </p>
        </div>
      `,
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" }
  }
}

export async function sendPriceChangeEmail(opts: {
  toEmail: string
  address: string
  oldPrice: number
  newPrice: number
  listingUrl: string | null
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }

  const fmt = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
  const diff = opts.newPrice - opts.oldPrice
  const direction = diff > 0 ? "increased" : "decreased"
  const appUrl = process.env.APP_URL || "http://localhost:3000"

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to: opts.toEmail,
      subject: `Price ${direction}: ${opts.address}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
          <h2 style="color: #2563eb;">Watchlist Price Change</h2>
          <p>A property on your watchlist has ${direction} in price.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb;">
            <p style="margin: 0 0 8px;">${opts.address}</p>
            <p style="margin: 0 0 4px;"><span style="color: #6b7280;">Was:</span> <strong>${fmt(opts.oldPrice)}</strong></p>
            <p style="margin: 0 0 12px;"><span style="color: #6b7280;">Now:</span> <strong style="color: ${diff < 0 ? "#16a34a" : "#dc2626"}">${fmt(opts.newPrice)}</strong></p>
            ${opts.listingUrl ? `<a href="${opts.listingUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Listing</a>` : ""}
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
            Manage your watchlist at <a href="${appUrl}/dashboard/sourcing-alerts">${appUrl}/dashboard/sourcing-alerts</a>
          </p>
        </div>
      `,
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" }
  }
}
