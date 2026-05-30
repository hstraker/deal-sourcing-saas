/**
 * POST /api/vendor-leads/[id]/due-diligence
 *
 * Generates a tailored AI due diligence checklist for a vendor lead.
 *
 * The route:
 * 1. Fetches the lead with its latest portal check + ownership data.
 * 2. Runs a deterministic flag-detection pass to identify which risk categories apply.
 * 3. Calls Claude to write rich, actionable checklist items for each category.
 * 4. Returns the checklist as a structured JSON array.
 *
 * Returns:
 *   { items: DDChecklistItem[], flags: string[], generatedAt: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DDChecklistItem {
  id: string
  category: string
  categoryLabel: string
  priority: "critical" | "important" | "standard"
  task: string
  rationale: string
  who: string
  timeframe: string
}

export interface DDChecklistResponse {
  items: DDChecklistItem[]
  flags: string[]
  generatedAt: string
  propertyAddress: string | null
}

// ─── Flag detection ───────────────────────────────────────────────────────────

interface LeadFlags {
  isLeasehold: boolean
  leaseYearsRemaining: number | null
  isShortLease: boolean             // < 80 years
  isVeryShortLease: boolean         // < 70 years
  groundRentPerAnnum: number | null
  serviceChargePerAnnum: number | null
  floodZone: "zone1" | "zone2" | "zone3" | "unknown" | null
  isFloodRisk: boolean
  isCorporateOwned: boolean
  isOverseasOwned: boolean
  isRepossession: boolean
  isProbate: boolean
  isAuction: boolean
  epcRating: string | null
  isPoorEpc: boolean                // F or G
  latestCheckRisk: string | null
  hasPortalRisk: boolean
  propertyType: string | null
  isHmoCandidate: boolean           // 3+ beds
  bedrooms: number | null
  hasMultipleAgents: boolean
  summaryFlagCodes: string[]
  ambiguityReasons: string[]
  companyName: string | null
}

function extractFlags(lead: {
  tenureType: string | null
  leaseholdData: unknown
  floodRiskZone: string | null
  epcRating: string | null
  latestCheckRisk: string | null
  propertyType: string | null
  bedrooms: number | null
  portalChecks: {
    summaryFlags: unknown
    ownershipCheckRaw: unknown
    portalCheckRaw: unknown
  }[]
}): LeadFlags {
  // ── Leasehold ───────────────────────────────────────────────────────────────
  const isLeasehold = lead.tenureType?.toLowerCase().includes("leasehold") ?? false
  const ld = lead.leaseholdData as Record<string, unknown> | null
  const leaseYearsRemaining = typeof ld?.yearsRemaining === "number" ? ld.yearsRemaining : null
  const isShortLease = leaseYearsRemaining != null && leaseYearsRemaining < 80
  const isVeryShortLease = leaseYearsRemaining != null && leaseYearsRemaining < 70
  const groundRentPerAnnum = typeof ld?.groundRentPerAnnum === "number" ? ld.groundRentPerAnnum : null
  const serviceChargePerAnnum = typeof ld?.serviceChargePerAnnum === "number" ? ld.serviceChargePerAnnum : null

  // ── Flood ────────────────────────────────────────────────────────────────────
  const floodZone = lead.floodRiskZone as LeadFlags["floodZone"] | null
  const isFloodRisk = floodZone === "zone2" || floodZone === "zone3"

  // ── EPC ─────────────────────────────────────────────────────────────────────
  const epcRating = lead.epcRating
  const isPoorEpc = !!epcRating && ["F", "G"].includes(epcRating.toUpperCase())

  // ── Ownership & portal check ─────────────────────────────────────────────────
  const latestCheck = lead.portalChecks[0]
  const summaryFlags = (Array.isArray(latestCheck?.summaryFlags) ? latestCheck.summaryFlags : []) as {
    code: string; severity: string; label: string; detail: string
  }[]
  const summaryFlagCodes = summaryFlags.map(f => f.code)

  const ownershipRaw = latestCheck?.ownershipCheckRaw as Record<string, unknown> | null
  const isCorporateOwned = ownershipRaw?.isCorporateOwned === true
  const isOverseasOwned  = ownershipRaw?.isOverseasOwned === true
  const companyName      = typeof ownershipRaw?.companyName === "string" ? ownershipRaw.companyName : null

  const portalRaw = latestCheck?.portalCheckRaw as Record<string, unknown> | null
  const hasMultipleAgents = summaryFlagCodes.includes("MULTI_AGENT") ||
    (typeof portalRaw?.agentCount === "number" && (portalRaw.agentCount as number) > 1)

  const ambiguityReasons: string[] = []
  try {
    const ambig = (latestCheck as unknown as { ambiguityReasons?: unknown })?.ambiguityReasons
    if (Array.isArray(ambig)) ambiguityReasons.push(...ambig.map(String))
  } catch { /* ignore */ }

  // ── Deal type flags ──────────────────────────────────────────────────────────
  const isRepossession = summaryFlagCodes.includes("REPOSSESSION") ||
    (lead.latestCheckRisk === "red_flag" && summaryFlagCodes.some(c => c.includes("REPO")))
  const isProbate = summaryFlagCodes.includes("PROBATE")
  const isAuction = summaryFlagCodes.includes("AUCTION")

  // ── HMO ─────────────────────────────────────────────────────────────────────
  const bedrooms = lead.bedrooms
  const isHmoCandidate = (bedrooms ?? 0) >= 3

  return {
    isLeasehold,
    leaseYearsRemaining,
    isShortLease,
    isVeryShortLease,
    groundRentPerAnnum,
    serviceChargePerAnnum,
    floodZone,
    isFloodRisk,
    isCorporateOwned,
    isOverseasOwned,
    isRepossession,
    isProbate,
    isAuction,
    epcRating,
    isPoorEpc,
    latestCheckRisk: lead.latestCheckRisk,
    hasPortalRisk: lead.latestCheckRisk === "red_flag" || lead.latestCheckRisk === "caution",
    propertyType: lead.propertyType,
    isHmoCandidate,
    bedrooms,
    hasMultipleAgents,
    summaryFlagCodes,
    ambiguityReasons,
    companyName,
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  lead: {
    propertyAddress: string | null
    propertyPostcode: string | null
    askingPrice: unknown
    estimatedMarketValue: unknown
    propertyType: string | null
    bedrooms: number | null
    tenureType: string | null
    reasonForSelling: string | null
    epcRating: string | null
    validationNotes: string | null
  },
  flags: LeadFlags
): string {
  const price = lead.askingPrice ? `£${Number(lead.askingPrice).toLocaleString("en-GB")}` : "unknown"
  const emv   = lead.estimatedMarketValue ? `£${Number(lead.estimatedMarketValue).toLocaleString("en-GB")}` : "unknown"
  const bmvPct = (lead.askingPrice && lead.estimatedMarketValue)
    ? `${(((Number(lead.estimatedMarketValue) - Number(lead.askingPrice)) / Number(lead.estimatedMarketValue)) * 100).toFixed(1)}% BMV`
    : ""

  const activeFlagLines: string[] = []
  if (flags.isLeasehold)        activeFlagLines.push(`- LEASEHOLD: ${flags.leaseYearsRemaining != null ? `${flags.leaseYearsRemaining} years remaining` : "years remaining unknown"}${flags.groundRentPerAnnum ? `, ground rent £${flags.groundRentPerAnnum}/yr` : ""}${flags.serviceChargePerAnnum ? `, service charge £${flags.serviceChargePerAnnum}/yr` : ""}`)
  if (flags.isShortLease)       activeFlagLines.push(`- SHORT LEASE: ${flags.leaseYearsRemaining} years — mortgage lenders typically require ≥ 70 years unexpired plus term`)
  if (flags.isVeryShortLease)   activeFlagLines.push(`- VERY SHORT LEASE: ${flags.leaseYearsRemaining} years — statutory extension process likely required (Leasehold Reform Act)`)
  if (flags.isFloodRisk)        activeFlagLines.push(`- FLOOD RISK: Zone ${flags.floodZone?.replace("zone","") ?? "?"} — ${flags.floodZone === "zone3" ? "High risk >1% annual probability" : "Medium risk 0.1–1%"}`)
  if (flags.isCorporateOwned)   activeFlagLines.push(`- CORPORATE VENDOR: ${flags.companyName ?? "company name unknown"} — verify authority to sell, check Companies House`)
  if (flags.isOverseasOwned)    activeFlagLines.push(`- OVERSEAS OWNERSHIP: Entity incorporated overseas — verify authority, source of funds, SDLT surcharges`)
  if (flags.isRepossession)     activeFlagLines.push(`- REPOSSESSION: Property being sold by lender or administrator — confirm vacant possession, check for charges`)
  if (flags.isProbate)          activeFlagLines.push(`- PROBATE: Estate sale — confirm grant of probate obtained, all executors must execute`)
  if (flags.isAuction)          activeFlagLines.push(`- AUCTION: Sale by auction — 28-day completion typical, legal pack review critical before bidding`)
  if (flags.isPoorEpc)          activeFlagLines.push(`- POOR EPC: Rating ${flags.epcRating} — Minimum Energy Efficiency Standards (MEES) apply; may be unlettable unless EPC improvement exemption obtained`)
  if (flags.hasMultipleAgents)  activeFlagLines.push(`- MULTI-AGENT LISTING: Listed with multiple agents — may signal previous sale fall-through or difficult property`)
  if (flags.isHmoCandidate)     activeFlagLines.push(`- HMO CANDIDATE: ${flags.bedrooms}-bed property — verify local HMO licensing requirements if multi-let strategy planned`)
  if (flags.hasPortalRisk)      activeFlagLines.push(`- PORTAL RISK FLAGS: ${flags.summaryFlagCodes.join(", ")}`)

  return `You are a UK property sourcing expert generating a due diligence checklist for a residential or commercial investment deal.

PROPERTY OVERVIEW:
- Address: ${lead.propertyAddress ?? "Not provided"}
- Postcode: ${lead.propertyPostcode ?? "Not provided"}
- Type: ${lead.propertyType ?? "Not provided"} | ${lead.bedrooms ? `${lead.bedrooms} bed` : "beds unknown"}
- Asking price: ${price} | Market value: ${emv} ${bmvPct ? `(${bmvPct})` : ""}
- Tenure: ${flags.isLeasehold ? "Leasehold" : (lead.tenureType ?? "Unknown")}
- EPC: ${lead.epcRating ?? "Not checked"}
- Reason for selling: ${lead.reasonForSelling ?? "Not stated"}
${lead.validationNotes ? `- Validation notes: ${lead.validationNotes}` : ""}

ACTIVE FLAGS (these drive the checklist — write items for every flag):
${activeFlagLines.length > 0 ? activeFlagLines.join("\n") : "- No specific risk flags identified"}

STANDARD CHECKS (always include):
- Legal title verification
- Local authority search
- Water and drainage search
- Environmental search (including flood, ground contamination)
- Buildings insurance quotation before exchange
- Survey (level appropriate to property condition)
- Solicitor instruction and conflict check
- Anti-money laundering (AML) compliance — source of funds

INSTRUCTIONS:
Generate a comprehensive, prioritised due diligence checklist. Return ONLY a valid JSON array — no markdown, no explanation, just the array.

Each item must have:
{
  "id": "unique-snake-case-id",
  "category": one of: "leasehold" | "flood" | "ownership" | "legal" | "structural" | "financial" | "compliance" | "commercial" | "standard",
  "categoryLabel": human-readable category name (e.g. "Leasehold Risk", "Flood & Environmental"),
  "priority": "critical" | "important" | "standard",
  "task": "Imperative sentence — what to do",
  "rationale": "Why this matters for this specific property — 1–2 sentences, specific to the flags",
  "who": "solicitor" | "surveyor" | "buyer" | "agent" | "solicitor + buyer",
  "timeframe": "Before exchange" | "Before completion" | "Before offer" | "Before bidding" | "ASAP"
}

Priority rules:
- critical = must complete before exchange; failure could abort the deal or cause major loss
- important = strongly recommended; skipping creates significant risk
- standard = good practice; skip only with informed consent

Produce 12–20 items. Order by priority (critical first), then by category. Be specific — reference the actual flags, lease years, flood zone, company name etc. from the data above. Do not use generic boilerplate — every item must be tailored to this property.`
}

// ─── Route handler ────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      propertyType: true,
      bedrooms: true,
      tenureType: true,
      leaseholdData: true,
      floodRiskZone: true,
      epcRating: true,
      latestCheckRisk: true,
      reasonForSelling: true,
      validationNotes: true,
      portalChecks: {
        orderBy: { triggeredAt: "desc" },
        take: 1,
        select: {
          summaryFlags: true,
          ownershipCheckRaw: true,
          portalCheckRaw: true,
        },
      },
    },
  })

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const flags = extractFlags(lead)

  // Build a human-readable list of active flags for the response
  const activeFlagLabels: string[] = []
  if (flags.isLeasehold)       activeFlagLabels.push(`Leasehold (${flags.leaseYearsRemaining ?? "?"}yr)`)
  if (flags.isShortLease)      activeFlagLabels.push("Short lease")
  if (flags.isFloodRisk)       activeFlagLabels.push(`Flood Zone ${flags.floodZone?.replace("zone","")}`)
  if (flags.isCorporateOwned)  activeFlagLabels.push("Corporate vendor")
  if (flags.isOverseasOwned)   activeFlagLabels.push("Overseas ownership")
  if (flags.isRepossession)    activeFlagLabels.push("Repossession")
  if (flags.isProbate)         activeFlagLabels.push("Probate")
  if (flags.isAuction)         activeFlagLabels.push("Auction")
  if (flags.isPoorEpc)         activeFlagLabels.push(`EPC ${flags.epcRating}`)
  if (flags.hasMultipleAgents) activeFlagLabels.push("Multi-agent")
  if (flags.isHmoCandidate)    activeFlagLabels.push("HMO candidate")

  const prompt = buildPrompt(lead, flags)

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    })

    const rawText = message.content[0].type === "text" ? message.content[0].text : ""
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

    let items: DDChecklistItem[] = []
    try {
      items = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: rawText }, { status: 500 })
    }

    const response: DDChecklistResponse = {
      items,
      flags: activeFlagLabels,
      generatedAt: new Date().toISOString(),
      propertyAddress: lead.propertyAddress,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[DD Checklist] Claude error:", err)
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 })
  }
}
