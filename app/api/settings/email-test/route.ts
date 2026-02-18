import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { verifySmtpConnection, sendTestEmail } from "@/lib/email"

/** GET — verify SMTP connection and return config status */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await verifySmtpConnection()

  return NextResponse.json({
    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || null,
    user: process.env.SMTP_USER || null,
    fromName: process.env.SMTP_FROM_NAME || null,
    connected: result.ok,
    error: result.error || null,
  })
}

/** POST { to: string } — send a test email */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const to: string = body.to || (session.user as any)?.email

  if (!to) {
    return NextResponse.json({ error: "No recipient email address" }, { status: 400 })
  }

  const result = await sendTestEmail(to)

  if (result.success) {
    return NextResponse.json({ success: true, to })
  }

  return NextResponse.json(
    { success: false, error: result.error, noSmtp: result.noSmtp },
    { status: result.noSmtp ? 503 : 500 }
  )
}
