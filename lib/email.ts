/**
 * Email utility — Hostinger SMTP via Nodemailer
 *
 * Required env vars:
 *   SMTP_HOST       smtp.hostinger.com
 *   SMTP_PORT       465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER       full email address e.g. deals@yourdomain.com
 *   SMTP_PASSWORD   Hostinger email account password
 *   SMTP_FROM_NAME  Display name (optional, defaults to SMTP_USER)
 *   APP_URL         Public URL of the app
 */

import nodemailer from "nodemailer"

export interface EmailResult {
  success: boolean
  noSmtp?: boolean
  error?: string
}

// Same type alias used elsewhere
export type InvestorPackEmailResult = EmailResult

// ─── Transporter ──────────────────────────────────────────────────────────────

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

function getTransporter() {
  if (!isSmtpConfigured()) return null

  const port = parseInt(process.env.SMTP_PORT || "465")
  const secure = port === 465 // SSL for 465; STARTTLS for 587

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Needed for self-signed certs on some Hostinger regions; remove if not needed
    tls: {
      rejectUnauthorized: true,
    },
    // Increase timeout for slower connections
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
}

function fromAddress(): string {
  const name = process.env.SMTP_FROM_NAME || process.env.SMTP_USER || "DealStack"
  const addr = process.env.SMTP_USER || "noreply@dealstack.co.uk"
  return `"${name}" <${addr}>`
}

// ─── Connection verification ──────────────────────────────────────────────────

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const transporter = getTransporter()
  if (!transporter) {
    return { ok: false, error: "SMTP not configured — check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env" }
  }
  try {
    await transporter.verify()
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || "Connection failed" }
  }
}

// ─── Test email ───────────────────────────────────────────────────────────────

export async function sendTestEmail(to: string): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: "DealStack — Email Test",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="color:#2563eb;margin-top:0;">Email is working ✓</h2>
          <p>This is a test email from your DealStack application.</p>
          <p style="color:#64748b;font-size:13px;">
            Sent via ${process.env.SMTP_HOST} · ${new Date().toLocaleString("en-GB")}
          </p>
        </div>
      `,
      text: `DealStack email test — sent via ${process.env.SMTP_HOST} at ${new Date().toLocaleString("en-GB")}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Test email failed:", err)
    return { success: false, error: err.message || "Failed to send test email" }
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — password reset email not sent")
    console.log(`[email] Reset token for ${email}: ${resetToken}`)
    return
  }

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to: email,
      subject: "Reset Your Password — DealStack",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#f4f4f4;padding:28px;border-radius:8px;">
            <h2 style="color:#2563eb;margin-top:0;">Reset Your Password</h2>
            <p>You requested to reset your password for your DealStack account.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" style="background:#2563eb;color:white;padding:13px 32px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
                Reset Password
              </a>
            </div>
            <p style="font-size:12px;color:#666;">Or copy: <span style="word-break:break-all;">${resetUrl}</span></p>
            <p style="font-size:12px;color:#999;margin-top:24px;">Link expires in 1 hour. If you didn't request this, ignore it.</p>
          </div>
        </body>
        </html>
      `,
      text: `Reset your DealStack password: ${resetUrl}\n\nExpires in 1 hour.`,
    })
    console.log(`[email] Password reset sent to ${email}`)
  } catch (err: any) {
    console.error("[email] Password reset failed:", err)
    throw new Error("Failed to send password reset email")
  }
}

// ─── Staff invite email ───────────────────────────────────────────────────────

export async function sendInviteEmail(
  to: string,
  displayName: string,
  inviteUrl: string
): Promise<{ success: boolean; noSmtp?: boolean }> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — invite email not sent")
    console.log(`[email] Invite URL for ${to}: ${inviteUrl}`)
    return { success: false, noSmtp: true }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `You've been invited to ${fromName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#f4f4f4;padding:28px;border-radius:8px;">
            <h2 style="color:#F5A623;margin-top:0;">You've been invited!</h2>
            <p>Hi ${displayName || to},</p>
            <p>You've been invited to join <strong>${fromName}</strong>. Click the button below to set your password and access your account.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${inviteUrl}" style="background:#F5A623;color:#1A1A1F;padding:13px 32px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
                Set Your Password
              </a>
            </div>
            <p style="font-size:12px;color:#666;">Or copy this link: <span style="word-break:break-all;">${inviteUrl}</span></p>
            <p style="font-size:12px;color:#999;margin-top:24px;">This link expires in 48 hours. If you weren't expecting this invitation, you can safely ignore it.</p>
          </div>
        </body>
        </html>
      `,
      text: `You've been invited to ${fromName}.\n\nSet your password: ${inviteUrl}\n\nExpires in 48 hours.`,
    })
    console.log(`[email] Invite sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Invite email failed:", err)
    return { success: false }
  }
}

// ─── Investor pack email ──────────────────────────────────────────────────────

function formatPropertyType(type?: string): string {
  if (!type) return "Property"
  const map: Record<string, string> = {
    terraced: "Terraced House",
    semi: "Semi-Detached House",
    detached: "Detached House",
    flat: "Flat",
    apartment: "Apartment",
    bungalow: "Bungalow",
    maisonette: "Maisonette",
  }
  return map[type.toLowerCase()] ?? (type.charAt(0).toUpperCase() + type.slice(1))
}

function extractTown(address: string): string {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean)
  // Address format: "Street, Town, County, Postcode" — take part at index 1 as town
  return parts.length >= 2 ? parts[1] : parts[0] || address
}

export async function sendInvestorPackEmail({
  to,
  investorName,
  dealAddress,
  dealId,
  packLabel,
  appUrl,
  downloadToken,
  interestToken,
  propertyType,
  bedrooms,
  marketValue,
  monthlyRent,
  postcode,
  companyName,
  companyAddress,
  companyPhone,
}: {
  to: string
  investorName: string
  dealAddress: string
  dealId: string
  packLabel: string
  appUrl: string
  downloadToken?: string
  interestToken?: string
  propertyType?: string
  bedrooms?: number
  marketValue?: number
  monthlyRent?: number
  postcode?: string
  companyName?: string
  companyAddress?: string
  companyPhone?: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — investor pack email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const packUrl = downloadToken
    ? `${appUrl}/api/deals/${dealId}/investor-pack?token=${downloadToken}`
    : `${appUrl}/api/deals/${dealId}/investor-pack`

  const interestUrl = interestToken ? `${appUrl}/api/investor-interest?token=${interestToken}` : null
  const fromName = companyName || process.env.SMTP_FROM_NAME || "DealStack"
  const year = new Date().getFullYear()

  // ── Computed deal metrics ──────────────────────────────────────────────────
  const propTypeLabel = formatPropertyType(propertyType)
  const town = extractTown(dealAddress)
  const bedsLabel = bedrooms ? `${bedrooms} Bed ` : ""

  // Build subject line
  const subject = `Exclusive Investment Opportunity — ${bedsLabel}${propTypeLabel} in ${town}`

  // ── Intro paragraph ────────────────────────────────────────────────────────
  const introHtml = marketValue
    ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
        We have an exciting property available${bedrooms ? ` — a <strong>${bedsLabel}${propTypeLabel}</strong>` : ""} located in <strong>${town}</strong>.
        Take a look at the deal below and register your interest if you'd like to proceed.
      </p>`
    : `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
        We have secured a great investment opportunity for you. Take a look at the details below and register your interest if you'd like to find out more.
      </p>`

  // ── THE DEAL metrics rows ─────────────────────────────────────────────────
  const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`
  const rowStyle = `padding:8px 0;font-size:14px;border-bottom:1px solid #f1f5f9;`

  const marketValueRow = marketValue
    ? `<tr>
        <td style="${rowStyle}color:#64748b;">Open Market Value (OMV)</td>
        <td style="${rowStyle}text-align:right;font-weight:600;color:#1e293b;">${gbp(marketValue)}</td>
      </tr>`
    : ""

  const rentRow = monthlyRent
    ? `<tr>
        <td style="padding:8px 0;font-size:14px;color:#64748b;">Estimated Monthly Rent</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;">${gbp(monthlyRent)} pcm</td>
      </tr>`
    : ""

  const locationRow = postcode
    ? `<tr>
        <td style="${rowStyle}color:#64748b;">Location</td>
        <td style="${rowStyle}text-align:right;font-weight:600;color:#1e293b;">${town}${postcode ? `, ${postcode}` : ""}</td>
      </tr>`
    : ""

  // ── Register Interest CTA ─────────────────────────────────────────────────
  const interestCtaHtml = interestUrl
    ? `<div style="text-align:center;margin:24px 0 8px;">
        <a href="${interestUrl}" style="display:inline-block;background:#059669;color:white;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:700;font-size:16px;letter-spacing:0.3px;">
          ✓ Register My Interest
        </a>
      </div>`
    : ""

  // ── PDF download link ─────────────────────────────────────────────────────
  const pdfLinkHtml = `<div style="text-align:center;margin:8px 0 24px;">
    <a href="${packUrl}" style="color:#2563eb;font-size:14px;text-decoration:underline;">
      View Full Investor Pack (PDF)
    </a>
  </div>`

  // ── Company footer ────────────────────────────────────────────────────────
  const footerDetails = [
    companyName ? `<strong>${companyName}</strong>` : null,
    companyAddress ?? null,
    companyPhone ? `Tel: ${companyPhone}` : null,
  ]
    .filter(Boolean)
    .join("<br>")

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#333;background:#f0f0f0;margin:0;padding:20px 0;">
  <div style="max-width:600px;margin:0 auto;">

    <!-- Header -->
    <div style="background:#1e3a8a;padding:24px 28px;border-radius:8px 8px 0 0;">
      <h1 style="color:white;margin:0;font-size:20px;">${fromName}</h1>
      <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:12px;">Exclusive Property Investment</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">

      <p style="margin:0 0 16px;color:#475569;">Hi ${investorName},</p>

      ${introHtml}

      <!-- THE DEAL -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;overflow:hidden;">
        <div style="background:#1e3a8a;color:white;text-align:center;padding:9px 16px;font-weight:700;font-size:13px;letter-spacing:1.5px;">
          THE DEAL
        </div>
        <div style="padding:16px 20px;">
          <p style="font-weight:700;font-size:15px;color:#1e293b;margin:0 0 12px;">${dealAddress}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${locationRow}
            ${marketValueRow}
            ${rentRow}
          </table>
        </div>
      </div>

      <!-- Primary CTA -->
      ${interestCtaHtml}

      <!-- PDF link -->
      ${pdfLinkHtml}

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

      <!-- How to secure -->
      <h3 style="color:#1e293b;font-size:15px;margin:0 0 12px;">How Do I Secure A Deal?</h3>
      <ol style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:14px;line-height:1.9;">
        <li>Register your interest by clicking the button above or replying to this email.</li>
        <li>We will get in touch to confirm your interest and verify you are ready to proceed.</li>
        <li>Pay the reservation fee to secure the deal (typically £1,000–£2,000).</li>
        <li>Instruct your solicitor — we will send the lock-out agreement, securing the deal for 28 days.</li>
        <li>Exchange and complete. Timescales vary but typically 4–8 weeks.</li>
      </ol>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

      <!-- Documents needed -->
      <h3 style="color:#1e293b;font-size:15px;margin:0 0 12px;">What Documents Do You Need?</h3>

      <p style="color:#1e293b;font-size:14px;font-weight:600;margin:0 0 6px;">Company Purchase:</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#475569;font-size:14px;line-height:1.9;">
        <li>Proof of ID for all directors</li>
        <li>Proof of address for all directors</li>
        <li>Proof of funds</li>
      </ul>

      <p style="color:#1e293b;font-size:14px;font-weight:600;margin:0 0 6px;">Personal Purchase:</p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:14px;line-height:1.9;">
        <li>Proof of ID</li>
        <li>Proof of address</li>
        <li>Proof of funds / mortgage agreement in principle</li>
      </ul>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

      <!-- Footer -->
      ${footerDetails ? `<p style="font-size:12px;color:#64748b;margin:0 0 8px;">${footerDetails}</p>` : ""}
      <p style="font-size:11px;color:#94a3b8;margin:0;">
        This is a confidential communication. Please do not forward without permission.<br>
        © ${year} ${fromName}. All rights reserved.
      </p>

    </div>
  </div>
</body>
</html>`

  const textParts = [
    `Hi ${investorName},`,
    "",
    `THE DEAL — ${dealAddress}`,
    marketValue ? `Open Market Value: ${gbp(marketValue)}` : "",
    monthlyRent ? `Estimated Monthly Rent: ${gbp(monthlyRent)} pcm` : "",
    "",
    interestUrl ? `Register Your Interest: ${interestUrl}` : "",
    `View Investor Pack (PDF): ${packUrl}`,
    "",
    "HOW TO SECURE:",
    "1. Register interest above or reply to this email",
    "2. We confirm your interest and readiness to proceed",
    "3. Pay the reservation fee (~£1,000–£2,000)",
    "4. Instruct your solicitor — lock-out agreement sent (28 days)",
    "5. Exchange and complete (typically 4–8 weeks)",
    "",
    `© ${year} ${fromName}`,
  ].filter((l) => l !== undefined).join("\n")

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject,
      html,
      text: textParts,
    })
    console.log(`[email] Investor pack sent to ${to} for deal ${dealId}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Investor pack email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Offer to investor email ───────────────────────────────────────────────────

export async function sendOfferToInvestorEmail({
  to,
  investorName,
  propertyAddress,
  offerAmount,
  askingPrice,
  bmvPct,
  message,
  appUrl,
}: {
  to: string
  investorName: string
  propertyAddress: string
  offerAmount: number
  askingPrice: number
  bmvPct: number
  message: string
  appUrl: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — offer email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const formattedOffer = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(offerAmount)
  const formattedAsking = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(askingPrice)

  // Convert plain-text message to HTML paragraphs
  const messageHtml = message
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 8px;">${line}</p>` : "<br>"))
    .join("")

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Investment Opportunity: ${propertyAddress}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Investment Opportunity</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Property Investment Opportunity</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <div style="margin-bottom:16px;color:#475569;">${messageHtml}</div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;">
              <h3 style="margin:0 0 16px;color:#1e293b;font-size:15px;">Deal Summary</h3>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:8px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Property</td>
                  <td style="padding:8px 0;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;">${propertyAddress}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Asking Price</td>
                  <td style="padding:8px 0;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;">${formattedAsking}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Our Offer</td>
                  <td style="padding:8px 0;text-align:right;">
                    <span style="background:#1e3a8a;color:white;padding:4px 12px;border-radius:4px;font-weight:700;font-size:16px;">${formattedOffer}</span>
                    <span style="display:block;font-size:12px;color:#64748b;margin-top:4px;">${bmvPct.toFixed(1)}% Below Market Value</span>
                  </td>
                </tr>
              </table>
            </div>
            <p style="color:#475569;font-size:14px;">Please let us know if you'd like to discuss further or if you have any questions.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">
              This is a confidential communication. Please do not forward without permission.<br>
              © ${new Date().getFullYear()} ${fromName}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${investorName},\n\n${message}\n\nProperty: ${propertyAddress}\nAsking Price: ${formattedAsking}\nOur Offer: ${formattedOffer} (${bmvPct.toFixed(1)}% BMV)\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    console.log(`[email] Offer email sent to ${to} for ${propertyAddress}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Offer email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Reservation pipeline: investor stage emails ──────────────────────────────

export async function sendReservationPackSentEmail({
  to,
  investorName,
  dealAddress,
  dealId,
  appUrl,
}: {
  to: string
  investorName: string
  dealAddress: string
  dealId: string
  appUrl: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const packUrl = `${appUrl}/api/deals/${dealId}/investor-pack`
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Investor Pack Ready: ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Investment Opportunity Update</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Your Investor Pack is Ready</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">Great news — your investor pack for <strong style="color:#1e3a8a;">${dealAddress}</strong> is now ready for download.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${packUrl}" style="background:#2563eb;color:white;padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;display:inline-block;">Download Investor Pack (PDF)</a>
            </div>
            <p style="font-size:12px;color:#94a3b8;text-align:center;">Or copy: <span style="word-break:break-all;">${packUrl}</span></p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. Confidential — do not forward without permission.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nYour investor pack for ${dealAddress} is ready.\n\nDownload: ${packUrl}\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Pack sent email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendReservationFeeRequestedEmail({
  to,
  investorName,
  dealAddress,
  feeAmount,
}: {
  to: string
  investorName: string
  dealAddress: string
  feeAmount: number
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(feeAmount)
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Reservation Fee Request: ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Reservation Fee Request</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Reservation Fee Requested</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">To secure your reservation on <strong style="color:#1e3a8a;">${dealAddress}</strong>, please arrange payment of the reservation fee:</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
              <div style="font-size:32px;font-weight:700;color:#1e3a8a;">${formatted}</div>
              <div style="color:#64748b;font-size:13px;margin-top:4px;">Reservation Fee</div>
            </div>
            <p style="color:#475569;font-size:14px;">Please contact us to arrange payment. Once received, your reservation will be confirmed.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. Confidential.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nReservation fee of ${formatted} requested for ${dealAddress}.\n\nPlease contact us to arrange payment.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Fee requested email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendReservationFeeConfirmedEmail({
  to,
  investorName,
  dealAddress,
}: {
  to: string
  investorName: string
  dealAddress: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Reservation Fee Received: ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Payment Confirmed</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <div style="text-align:center;margin:8px 0 24px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#d1fae5;">
                <span style="font-size:28px;">✓</span>
              </div>
            </div>
            <h2 style="color:#1e293b;margin-top:0;text-align:center;">Reservation Fee Received</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">We have received your reservation fee for <strong style="color:#1e3a8a;">${dealAddress}</strong>. Your reservation is now confirmed and we will be in touch shortly with the next steps.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. Confidential.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nReservation fee received for ${dealAddress}. Your reservation is confirmed.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Fee confirmed email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendPofRequestedEmail({
  to,
  investorName,
  dealAddress,
}: {
  to: string
  investorName: string
  dealAddress: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Proof of Funds Required: ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Action Required</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Proof of Funds Required</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">As part of the reservation process for <strong style="color:#1e3a8a;">${dealAddress}</strong>, we require proof of funds to proceed to the lock-out stage.</p>
            <p style="color:#475569;">Please provide one or more of the following:</p>
            <ul style="color:#475569;line-height:1.8;">
              <li>Bank statements (last 3 months)</li>
              <li>Mortgage Agreement in Principle (AIP)</li>
              <li>Bridging finance approval letter</li>
            </ul>
            <p style="color:#475569;font-size:14px;">Please reply to this email or contact us directly to submit your documents.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. Confidential.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nProof of funds required for ${dealAddress}.\n\nPlease provide bank statements or a mortgage AIP. Reply to this email or contact us directly.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] POF requested email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendPofReceivedEmail({
  to,
  investorName,
  dealAddress,
}: {
  to: string
  investorName: string
  dealAddress: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Proof of Funds Received: ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Update on Your Reservation</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Proof of Funds Received</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">We have received your proof of funds for <strong style="color:#1e3a8a;">${dealAddress}</strong>. We are now reviewing the documentation and will be in touch shortly regarding the lock-out agreement.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. Confidential.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nProof of funds received for ${dealAddress}. We will be in touch shortly.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] POF received email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendDealCompletedInvestorEmail({
  to,
  investorName,
  dealAddress,
}: {
  to: string
  investorName: string
  dealAddress: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Deal Completed: ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Deal Completed</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <div style="text-align:center;margin:8px 0 24px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:#d1fae5;">
                <span style="font-size:32px;">🏡</span>
              </div>
            </div>
            <h2 style="color:#1e293b;margin-top:0;text-align:center;">Congratulations!</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">We are delighted to confirm that your deal for <strong style="color:#1e3a8a;">${dealAddress}</strong> has been successfully completed. Congratulations on your new investment!</p>
            <p style="color:#475569;">Thank you for choosing ${fromName}. We look forward to working with you again on your next deal.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nCongratulations — your deal for ${dealAddress} has been completed!\n\nThank you for choosing ${fromName}.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Deal completed (investor) email failed:", err)
    return { success: false, error: err.message }
  }
}

// ─── Reservation pipeline: investor lock-out email ───────────────────────────

export async function sendLockOutSentInvestorEmail({
  to,
  investorName,
  dealAddress,
}: {
  to: string
  investorName: string
  dealAddress: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Lock-out Agreement Sent — ${dealAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Deal Update</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Lock-out Agreement Sent</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">Great news — we have sent the lock-out agreement for <strong style="color:#1e3a8a;">${dealAddress}</strong> to the vendor's solicitor for review and signature.</p>
            <p style="color:#475569;">Once signed by both parties, the deal will be formally secured. We will be in touch as soon as it has been executed.</p>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <p style="color:#1e40af;font-size:14px;margin:0;">
                <strong>What to do now:</strong><br>
                Please ensure your solicitor is ready to act quickly once the lock-out is returned. If you haven't already, please send us their contact details so we can liaise directly.
              </p>
            </div>
            <p style="color:#475569;font-size:14px;">If you have any questions in the meantime, please don't hesitate to get in touch.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. Confidential.</p>
          </div>
        </body></html>`,
      text: `Hi ${investorName},\n\nWe have sent the lock-out agreement for ${dealAddress} to the vendor's solicitor. Once signed, the deal will be formally secured.\n\nPlease ensure your solicitor is ready to act quickly.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Lock-out sent (investor) email failed:", err)
    return { success: false, error: err.message }
  }
}

// ─── Reservation pipeline: vendor stage emails ────────────────────────────────

export async function sendLockOutSentVendorEmail({
  to,
  vendorName,
  propertyAddress,
  companyName,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
  companyName: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = companyName || process.env.SMTP_FROM_NAME || "DealStack"
  const greeting = vendorName ? `Dear ${vendorName},` : "Dear Sir/Madam,"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Lock-out Agreement — ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Property Sale Update</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Lock-out Agreement Sent</h2>
            <p style="color:#475569;">${greeting}</p>
            <p style="color:#475569;">We are writing to confirm that we have prepared and sent a lock-out agreement in relation to the property at <strong style="color:#1e3a8a;">${propertyAddress}</strong>.</p>
            <p style="color:#475569;">The lock-out agreement will be forwarded to your solicitor for review and signature. Please ensure your solicitor is expecting the documentation.</p>
            <p style="color:#475569;">If you have any questions or have not heard from your solicitor within 48 hours, please do not hesitate to contact us.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. This is a confidential communication.</p>
          </div>
        </body></html>`,
      text: `${greeting}\n\nWe have sent a lock-out agreement for ${propertyAddress} to your solicitor. Please ensure they are expecting it.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Lock-out sent (vendor) email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendLockOutSignedVendorEmail({
  to,
  vendorName,
  propertyAddress,
  companyName,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
  companyName: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = companyName || process.env.SMTP_FROM_NAME || "DealStack"
  const greeting = vendorName ? `Dear ${vendorName},` : "Dear Sir/Madam,"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Lock-out Agreement Signed — ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Property Sale Update</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Lock-out Agreement Signed</h2>
            <p style="color:#475569;">${greeting}</p>
            <p style="color:#475569;">We are pleased to confirm that the lock-out agreement for <strong style="color:#1e3a8a;">${propertyAddress}</strong> has now been signed by all parties.</p>
            <p style="color:#475569;">This means the property is now reserved and we will be working towards completing the sale. Your solicitor will be in contact to progress the conveyancing.</p>
            <p style="color:#475569;">Thank you for your cooperation throughout this process.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. This is a confidential communication.</p>
          </div>
        </body></html>`,
      text: `${greeting}\n\nThe lock-out agreement for ${propertyAddress} has been signed. Your solicitor will be in contact to progress conveyancing.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Lock-out signed (vendor) email failed:", err)
    return { success: false, error: err.message }
  }
}

export async function sendDealCompletedVendorEmail({
  to,
  vendorName,
  propertyAddress,
  companyName,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
  companyName: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) return { success: false, noSmtp: true, error: "SMTP not configured" }
  const fromName = companyName || process.env.SMTP_FROM_NAME || "DealStack"
  const greeting = vendorName ? `Dear ${vendorName},` : "Dear Sir/Madam,"
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Sale Completed — ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Sale Completion Confirmation</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Sale Completed</h2>
            <p style="color:#475569;">${greeting}</p>
            <p style="color:#475569;">We are delighted to confirm that the sale of <strong style="color:#1e3a8a;">${propertyAddress}</strong> has now been completed.</p>
            <p style="color:#475569;">Thank you for choosing ${fromName} to assist with your property sale. We hope the process has been straightforward and we wish you well for the future.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
          </div>
        </body></html>`,
      text: `${greeting}\n\nThe sale of ${propertyAddress} has been completed. Thank you for choosing ${fromName}.\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[email] Deal completed (vendor) email failed:", err)
    return { success: false, error: err.message }
  }
}

// ─── Vendor: offer made notification (stage → OFFER_MADE) ────────────────────

export async function sendVendorOfferMadeEmail({
  to,
  vendorName,
  propertyAddress,
  offerAmount,
  offerPercentage,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
  offerAmount?: number | null
  offerPercentage?: number | null
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — vendor offer-made email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const greeting = vendorName ? `Dear ${vendorName},` : "Dear Property Owner,"
  const offerLine = offerAmount
    ? `<p style="margin:0 0 8px;">We are pleased to confirm that we have formally made an offer of <strong>£${offerAmount.toLocaleString()}</strong>${offerPercentage ? ` (${offerPercentage.toFixed(1)}% of market value)` : ""} on your property at <strong>${propertyAddress}</strong>.</p>`
    : `<p style="margin:0 0 8px;">We are pleased to confirm that we have formally made an offer on your property at <strong>${propertyAddress}</strong>.</p>`

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Offer Made on Your Property — ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Offer Notification</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;">${greeting}</p>
            ${offerLine}
            <p style="margin:0 0 8px;">Here is what happens next:</p>
            <ol style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
              <li>You can <strong>review and respond</strong> to our offer at your convenience.</li>
              <li>If you are happy to proceed, our team will arrange for solicitors on both sides to begin the conveyancing process.</li>
              <li>We will prepare a <strong>lock-out agreement</strong> to secure the transaction and protect both parties.</li>
              <li>We aim to move through the process quickly and with minimal hassle to you.</li>
            </ol>
            <p style="margin:0 0 8px;">If you have any questions or would like to discuss the offer, please do not hesitate to get in touch with us directly.</p>
            <p style="margin:0 0 8px;">Thank you for considering our offer — we look forward to hearing from you.</p>
            <p style="margin:0;">Kind regards,<br><strong>${fromName}</strong></p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">This is a confidential communication from ${fromName}.</p>
          </div>
        </body></html>
      `,
      text: `${greeting}\n\nWe are pleased to confirm that we have made an offer on your property at ${propertyAddress}.\n\nWhat happens next:\n1. Review and respond to our offer.\n2. Solicitors will begin conveyancing.\n3. We will prepare a lock-out agreement.\n4. We aim to complete the process quickly.\n\nKind regards,\n${fromName}`,
    })
    console.log(`[email] Vendor offer-made email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Vendor offer-made email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Vendor: offer rejected acknowledgement (stage → OFFER_REJECTED) ─────────

export async function sendVendorOfferRejectedEmail({
  to,
  vendorName,
  propertyAddress,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — vendor offer-rejected email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const greeting = vendorName ? `Dear ${vendorName},` : "Dear Property Owner,"

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Regarding Your Property at ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Thank You for Your Response</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;">${greeting}</p>
            <p style="margin:0 0 8px;">Thank you for taking the time to consider our offer for your property at <strong>${propertyAddress}</strong>.</p>
            <p style="margin:0 0 8px;">We understand that our offer may not have been the right fit for you at this time, and we completely respect your decision.</p>
            <p style="margin:0 0 8px;">Should your circumstances change in the future, or if you would like to revisit a potential sale, please do not hesitate to get in touch. We would be happy to discuss your options.</p>
            <p style="margin:0;">Kind regards,<br><strong>${fromName}</strong></p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">This is a confidential communication from ${fromName}.</p>
          </div>
        </body></html>
      `,
      text: `${greeting}\n\nThank you for considering our offer for ${propertyAddress}. We respect your decision and would welcome the opportunity to discuss further in the future.\n\nKind regards,\n${fromName}`,
    })
    console.log(`[email] Vendor offer-rejected email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Vendor offer-rejected email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Vendor: offer accepted thank-you (stage → OFFER_ACCEPTED) ────────────────

export async function sendVendorOfferAcceptedEmail({
  to,
  vendorName,
  propertyAddress,
  offerAmount,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
  offerAmount?: number | null
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — vendor offer-accepted email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const greeting = vendorName ? `Dear ${vendorName},` : "Dear Property Owner,"
  const offerLine = offerAmount
    ? `<p style="margin:0 0 8px;">We are delighted to confirm that you have accepted our offer of <strong>£${offerAmount.toLocaleString()}</strong> for your property at <strong>${propertyAddress}</strong>.</p>`
    : `<p style="margin:0 0 8px;">We are delighted to confirm that you have accepted our offer for your property at <strong>${propertyAddress}</strong>.</p>`

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Offer Accepted — Thank You for ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Offer Accepted</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;">${greeting}</p>
            ${offerLine}
            <p style="margin:0 0 8px;">Thank you so much — we are excited to work with you and will make this process as smooth as possible.</p>
            <p style="margin:0 0 8px;"><strong>What happens next:</strong></p>
            <ol style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
              <li>Our team will be in contact shortly to introduce you to our solicitor.</li>
              <li>We will send you a <strong>lock-out agreement</strong> to formally secure the sale and protect both parties during the process.</li>
              <li>Once the lock-out is signed, our solicitors will work with yours to progress the conveyancing.</li>
              <li>We aim to exchange contracts as quickly as possible to give you certainty and speed.</li>
            </ol>
            <p style="margin:0 0 8px;">If you have any questions at any stage, please do not hesitate to reach out to us.</p>
            <p style="margin:0;">Thank you again — we look forward to completing this transaction with you.<br><br>Kind regards,<br><strong>${fromName}</strong></p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">This is a confidential communication from ${fromName}.</p>
          </div>
        </body></html>
      `,
      text: `${greeting}\n\nWe are delighted to confirm that you have accepted our offer for ${propertyAddress}.\n\nWhat happens next:\n1. We will introduce you to our solicitor.\n2. We will send a lock-out agreement to secure the sale.\n3. Solicitors will progress conveyancing.\n4. We aim to exchange contracts quickly.\n\nThank you!\n\nKind regards,\n${fromName}`,
    })
    console.log(`[email] Vendor offer-accepted email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Vendor offer-accepted email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Vendor offer email ───────────────────────────────────────────────────────

export async function sendVendorOfferEmail({
  to,
  vendorName,
  propertyAddress,
  message,
  acceptLink,
  rejectLink,
}: {
  to: string
  vendorName?: string | null
  propertyAddress: string
  message: string
  acceptLink?: string
  rejectLink?: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — vendor offer email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"

  const messageHtml = message
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 8px;">${line}</p>` : "<br>"))
    .join("")

  const ctaHtml =
    acceptLink && rejectLink
      ? `
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px 24px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 6px;font-weight:600;color:#0369a1;font-size:15px;">Please respond to our offer:</p>
          <p style="margin:0 0 16px;font-size:13px;color:#475569;">Click one of the buttons below — no sign-in required.</p>
          <a href="${acceptLink}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;margin:0 8px 8px;">✅ Accept Offer</a>
          <a href="${rejectLink}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;margin:0 8px 8px;">✋ Decline Offer</a>
          <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">These links are valid for 14 days.</p>
        </div>`
      : ""

  const ctaText =
    acceptLink && rejectLink
      ? `\n\n--- RESPOND TO THIS OFFER ---\nAccept: ${acceptLink}\nDecline: ${rejectLink}\n(Links valid for 14 days)\n`
      : ""

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Offer on Your Property: ${propertyAddress}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Property Offer</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <div style="margin-bottom:16px;color:#475569;">${messageHtml}</div>
            ${ctaHtml}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">
              This is a confidential communication from ${fromName}.
            </p>
          </div>
        </body>
        </html>
      `,
      text: message + ctaText,
    })
    console.log(`[email] Vendor offer email sent to ${to} for ${propertyAddress}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Vendor offer email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Sourcer: validation passed notification ──────────────────────────────────

export async function sendSourcerValidationPassedEmail({
  to,
  sourcerName,
  propertyAddress,
  bmvScore,
  profitPotential,
  leadId,
}: {
  to: string
  sourcerName?: string | null
  propertyAddress: string
  bmvScore?: number | null
  profitPotential?: number | null
  leadId: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — sourcer validation-passed email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const appUrl = process.env.NEXTAUTH_URL || "https://app.dealstack.co.uk"
  const leadUrl = `${appUrl}/dashboard/vendors?lead=${leadId}`
  const greeting = sourcerName ? `Hi ${sourcerName},` : "Hi,"

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `✅ Deal Validated — Ready to Offer: ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#16a34a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Deal Validation Alert</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;">${greeting}</p>
            <p style="margin:0 0 12px;">A vendor lead has <strong>passed validation</strong> and is ready for you to make an offer:</p>
            <div style="background:white;border:1px solid #d1fae5;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
              <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#111;">${propertyAddress}</p>
              ${bmvScore != null ? `<p style="margin:0 0 4px;font-size:13px;color:#16a34a;font-weight:600;">BMV: ${bmvScore.toFixed(1)}%</p>` : ""}
              ${profitPotential != null ? `<p style="margin:0;font-size:13px;color:#0369a1;font-weight:600;">Profit Potential: £${profitPotential.toLocaleString()}</p>` : ""}
            </div>
            <p style="margin:0 0 20px;">Log in to review the validation results and send your offer:</p>
            <a href="${leadUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;">View Lead & Make Offer →</a>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">This is an automated alert from ${fromName}.</p>
          </div>
        </body></html>
      `,
      text: `${greeting}\n\nA lead at ${propertyAddress} has passed validation and is ready for an offer.${bmvScore != null ? `\nBMV: ${bmvScore.toFixed(1)}%` : ""}${profitPotential != null ? `\nProfit Potential: £${profitPotential.toLocaleString()}` : ""}\n\nView lead: ${leadUrl}`,
    })
    console.log(`[email] Sourcer validation-passed email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Sourcer validation-passed email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Sourcer: offer accepted notification ─────────────────────────────────────

export async function sendSourcerOfferAcceptedEmail({
  to,
  sourcerName,
  vendorName,
  propertyAddress,
  offerAmount,
  dealId,
  leadId,
}: {
  to: string
  sourcerName?: string | null
  vendorName: string
  propertyAddress: string
  offerAmount?: number | null
  dealId?: string | null
  leadId: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — sourcer offer-accepted email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const appUrl = process.env.NEXTAUTH_URL || "https://app.dealstack.co.uk"
  const dealUrl = dealId ? `${appUrl}/dashboard/deals/${dealId}` : `${appUrl}/dashboard/deals`
  const leadUrl = `${appUrl}/dashboard/vendors?lead=${leadId}`
  const greeting = sourcerName ? `Hi ${sourcerName},` : "Hi,"

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `🎉 Offer Accepted — ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Offer Accepted 🎉</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;">${greeting}</p>
            <p style="margin:0 0 12px;"><strong>${vendorName}</strong> has <strong style="color:#16a34a;">accepted your offer</strong> on:</p>
            <div style="background:white;border:1px solid #d1fae5;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
              <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#111;">${propertyAddress}</p>
              ${offerAmount != null ? `<p style="margin:0;font-size:14px;color:#16a34a;font-weight:600;">Accepted Offer: £${offerAmount.toLocaleString()}</p>` : ""}
            </div>
            <p style="margin:0 0 8px;font-weight:600;">A deal has been automatically created. Your next steps:</p>
            <ol style="margin:0 0 20px;padding-left:20px;line-height:1.9;font-size:14px;">
              <li>Add property photos to the deal</li>
              <li>Set the investor pack price</li>
              <li>Write the deal description and attach comparables</li>
              <li>Send lock-out agreement to vendor</li>
              <li>Mark the deal as Listed when ready for investors</li>
            </ol>
            <div style="display:flex;gap:12px;">
              <a href="${dealUrl}" style="display:inline-block;background:#1e3a8a;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;margin-right:8px;">Complete Deal Setup →</a>
              <a href="${leadUrl}" style="display:inline-block;background:white;border:1px solid #d1d5db;color:#374151;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">View Vendor Lead</a>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">This is an automated alert from ${fromName}.</p>
          </div>
        </body></html>
      `,
      text: `${greeting}\n\n${vendorName} has ACCEPTED your offer on ${propertyAddress}!${offerAmount != null ? `\nAccepted Offer: £${offerAmount.toLocaleString()}` : ""}\n\nA deal has been automatically created. Next steps:\n1. Add property photos\n2. Set investor pack price\n3. Write deal description\n4. Send lock-out agreement\n5. List the deal for investors\n\nComplete deal setup: ${dealUrl}\nView vendor lead: ${leadUrl}`,
    })
    console.log(`[email] Sourcer offer-accepted email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Sourcer offer-accepted email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}

// ─── Sourcer: offer rejected notification ─────────────────────────────────────

export async function sendSourcerOfferRejectedEmail({
  to,
  sourcerName,
  vendorName,
  propertyAddress,
  offerAmount,
  retryCount,
  leadId,
}: {
  to: string
  sourcerName?: string | null
  vendorName: string
  propertyAddress: string
  offerAmount?: number | null
  retryCount?: number
  leadId: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — sourcer offer-rejected email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const fromName = process.env.SMTP_FROM_NAME || "DealStack"
  const appUrl = process.env.NEXTAUTH_URL || "https://app.dealstack.co.uk"
  const leadUrl = `${appUrl}/dashboard/vendors?lead=${leadId}`
  const greeting = sourcerName ? `Hi ${sourcerName},` : "Hi,"
  const canRetry = (retryCount ?? 0) < 3

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `⚠️ Offer Rejected — ${propertyAddress}`,
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#b45309;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Offer Rejected</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;">${greeting}</p>
            <p style="margin:0 0 12px;"><strong>${vendorName}</strong> has <strong style="color:#dc2626;">rejected your offer</strong> on:</p>
            <div style="background:white;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
              <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#111;">${propertyAddress}</p>
              ${offerAmount != null ? `<p style="margin:0;font-size:13px;color:#dc2626;">Rejected Offer: £${offerAmount.toLocaleString()}</p>` : ""}
            </div>
            <p style="margin:0 0 8px;font-weight:600;">Decide your next step:</p>
            <ul style="margin:0 0 20px;padding-left:20px;line-height:1.9;font-size:14px;">
              ${canRetry ? '<li><strong>Retry</strong> — send a revised offer with a short video to rebuild rapport</li>' : ""}
              <li><strong>Close the lead</strong> — mark as Dead Lead if not worth pursuing</li>
              <li><strong>Nurture</strong> — schedule a follow-up for 30–60 days</li>
            </ul>
            <a href="${leadUrl}" style="display:inline-block;background:#b45309;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">Review Lead →</a>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">This is an automated alert from ${fromName}.</p>
          </div>
        </body></html>
      `,
      text: `${greeting}\n\n${vendorName} has REJECTED your offer on ${propertyAddress}.${offerAmount != null ? `\nRejected Offer: £${offerAmount.toLocaleString()}` : ""}\n\nNext steps:\n${canRetry ? "- Retry with a revised offer\n" : ""}- Close the lead (mark as Dead Lead)\n- Nurture for 30-60 days\n\nReview lead: ${leadUrl}`,
    })
    console.log(`[email] Sourcer offer-rejected email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Sourcer offer-rejected email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}
