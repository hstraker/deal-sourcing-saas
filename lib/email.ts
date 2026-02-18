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

// ─── Investor pack email ──────────────────────────────────────────────────────

export async function sendInvestorPackEmail({
  to,
  investorName,
  dealAddress,
  dealId,
  packLabel,
  appUrl,
}: {
  to: string
  investorName: string
  dealAddress: string
  dealId: string
  packLabel: string
  appUrl: string
}): Promise<EmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP not configured — investor pack email not sent")
    return { success: false, noSmtp: true, error: "SMTP not configured" }
  }

  const packUrl = `${appUrl}/api/deals/${dealId}/investor-pack`
  const fromName = process.env.SMTP_FROM_NAME || "DealStack"

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Investor Pack: ${dealAddress}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e3a8a;padding:28px 28px 20px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">${fromName}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Exclusive Investment Opportunity</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1e293b;margin-top:0;">Your Investor Pack is Ready</h2>
            <p style="color:#475569;">Hi ${investorName},</p>
            <p style="color:#475569;">Your <strong>${packLabel}</strong> for the property at <strong style="color:#1e3a8a;">${dealAddress}</strong> is ready.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${packUrl}" style="background:#2563eb;color:white;padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;display:inline-block;">
                Download Investor Pack (PDF)
              </a>
            </div>
            <p style="font-size:12px;color:#94a3b8;text-align:center;">
              If the button doesn't work, copy this link: <br>
              <span style="word-break:break-all;color:#64748b;">${packUrl}</span>
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">
              This is a confidential document. Please do not forward without permission.<br>
              © ${new Date().getFullYear()} ${fromName}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${investorName},\n\nYour ${packLabel} for ${dealAddress} is ready.\n\nDownload: ${packUrl}\n\n© ${new Date().getFullYear()} ${fromName}`,
    })
    console.log(`[email] Investor pack sent to ${to} for deal ${dealId}`)
    return { success: true }
  } catch (err: any) {
    console.error("[email] Investor pack email failed:", err)
    return { success: false, error: err.message || "Failed to send email" }
  }
}
