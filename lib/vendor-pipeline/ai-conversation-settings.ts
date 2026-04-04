/**
 * AI Conversation Settings helper
 * Fetches the singleton AIConversationSettings row, creating it with defaults if it
 * doesn't exist yet. Exposes a typed helper to check whether the AI should
 * auto-start for a given lead source.
 */

import { prisma } from "@/lib/db"

export type LeadSource = "facebook" | "manual" | "api"

export interface AIConvSettings {
  id: string
  enabled: boolean
  facebookLeadsEnabled: boolean
  manualLeadsEnabled: boolean
  apiLeadsEnabled: boolean
  sendInitialGreeting: boolean
  maxMessagesPerLead: number
  updatedAt: Date
  updatedBy: string | null
}

/**
 * Fetch (or create with defaults) the singleton settings row.
 */
export async function getAIConversationSettings(): Promise<AIConvSettings> {
  const existing = await prisma.aIConversationSettings.findFirst()
  if (existing) return existing

  // First-time bootstrap — create with sensible defaults
  return prisma.aIConversationSettings.create({
    data: {
      enabled: true,
      facebookLeadsEnabled: true,
      manualLeadsEnabled: false,
      apiLeadsEnabled: false,
      sendInitialGreeting: true,
      maxMessagesPerLead: 20,
    },
  })
}

/**
 * Returns true if the AI should auto-start for this lead source.
 * Both the global toggle AND the per-source toggle must be ON.
 */
export async function shouldAutoStartAI(source: LeadSource): Promise<boolean> {
  const settings = await getAIConversationSettings()

  if (!settings.enabled) return false

  switch (source) {
    case "facebook": return settings.facebookLeadsEnabled
    case "manual":   return settings.manualLeadsEnabled
    case "api":      return settings.apiLeadsEnabled
    default:         return false
  }
}
