/**
 * AI Conversation Settings API
 * GET  /api/ai-conversation-settings  — fetch current settings
 * PUT  /api/ai-conversation-settings  — update settings (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getAIConversationSettings } from "@/lib/vendor-pipeline/ai-conversation-settings"
import { z } from "zod"

const updateSchema = z.object({
  enabled:              z.boolean().optional(),
  facebookLeadsEnabled: z.boolean().optional(),
  manualLeadsEnabled:   z.boolean().optional(),
  apiLeadsEnabled:      z.boolean().optional(),
  sendInitialGreeting:  z.boolean().optional(),
  maxMessagesPerLead:   z.number().int().min(1).max(100).optional(),
})

// GET — any admin or sourcer can read settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const settings = await getAIConversationSettings()
    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error("[AI Conv Settings] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

// PUT — admin only
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const data = updateSchema.parse(body)

    // Upsert the singleton row
    const existing = await prisma.aIConversationSettings.findFirst()

    const settings = existing
      ? await prisma.aIConversationSettings.update({
          where: { id: existing.id },
          data: { ...data, updatedBy: session.user.id },
        })
      : await prisma.aIConversationSettings.create({
          data: {
            enabled:              data.enabled              ?? true,
            facebookLeadsEnabled: data.facebookLeadsEnabled ?? true,
            manualLeadsEnabled:   data.manualLeadsEnabled   ?? false,
            apiLeadsEnabled:      data.apiLeadsEnabled      ?? false,
            sendInitialGreeting:  data.sendInitialGreeting  ?? true,
            maxMessagesPerLead:   data.maxMessagesPerLead   ?? 20,
            updatedBy: session.user.id,
          },
        })

    return NextResponse.json({ settings })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[AI Conv Settings] PUT error:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
