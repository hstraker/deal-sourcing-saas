/**
 * Email utility for sending emails
 * Supports SMTP (development) and can be extended for AWS SES (production)
 */

import nodemailer from "nodemailer"

const getEmailTransporter = () => {
  // Use SMTP for development
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }

  // If no SMTP config, return null (emails won't be sent)
  return null
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<void> {
  const transporter = getEmailTransporter()
  
  if (!transporter) {
    console.warn("Email transporter not configured. Password reset email not sent.")
    console.log(`Password reset token for ${email}: ${resetToken}`)
    return
  }

  const resetUrl = `${process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`

  const mailOptions = {
    from: process.env.SMTP_USER || process.env.AWS_SES_FROM_EMAIL || "noreply@dealstack.com",
    to: email,
    subject: "Reset Your Password - DealStack",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h1 style="color: #2563eb; margin-top: 0;">Reset Your Password</h1>
            <p>You requested to reset your password for your DealStack account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              © ${new Date().getFullYear()} DealStack. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Reset Your Password

      You requested to reset your password for your DealStack account.

      Click the link below to reset your password:
      ${resetUrl}

      This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log(`Password reset email sent to ${email}`)
  } catch (error) {
    console.error("Error sending password reset email:", error)
    throw new Error("Failed to send password reset email")
  }
}

