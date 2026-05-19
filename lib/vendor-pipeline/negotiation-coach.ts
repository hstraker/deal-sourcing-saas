/**
 * Negotiation Coach — types and Claude prompt builder
 *
 * Produces world-class, deal-specific negotiation strategy by combining:
 *   - Chris Voss (FBI): tactical empathy, labelling, calibrated questions, anchoring
 *   - Oren Klaff: frame control, prizing, status frames, time pressure
 *   - Roger Dawson: tapering concessions, higher authority gambit, reluctant buyer
 *   - UK property sourcing best practice (Samuel Leeds, Rob Moore, Progressive)
 */

import type { NegotiationRung } from "@/lib/offer-engine/negotiation-ladder"

// ─────────────────────────────────────────────────────────────────────────────
// Output types (what Claude returns as JSON)
// ─────────────────────────────────────────────────────────────────────────────

export interface CoachPrinciple {
  emoji: string
  title: string
  description: string
}

export interface CoachPlaybookStep {
  step: number
  colour: "blue" | "amber" | "red"
  title: string
  body: string
  script?: string               // italicised example phrase
  scriptType?: "example" | "warning"
}

export interface CoachRoundScript {
  round: number                 // matches NegotiationRung.round
  smsScript: string
  callScript: string
  urgencyLever: string
  evidencePack: string
  coachTip?: string
}

export interface CoachObjection {
  emoji: string
  title: string                 // Short objection label
  whyTheySayIt: string
  response: string              // Exact script to use
  tags: string[]                // e.g. ["financial_pressure", "follow_with_speed"]
}

export interface CoachCopilotState {
  currentRoundLabel: string     // e.g. "Opening Offer sent"
  analysisPoints: string[]      // 3-4 bullet insights on current state
  suggestedFollowUp: string     // ready-to-send follow-up message
  waitAdvice: string            // e.g. "Wait at least 6 hours before following up"
}

export interface CoachOutput {
  strategyName: string
  strategyRationale: string
  negotiationScore: number      // 0-100
  vendorProfile: {
    motivationType: string      // "financial_pressure" | "probate" | "relocation" | "divorce" | "downsizing" | "other"
    motivationLabel: string     // Human label e.g. "Financial Pressure"
    motivationEmoji: string     // e.g. "💸"
    motivationConfidence: number
    urgencySignal: "low" | "medium" | "high" | "very_high"
    priceFlexibility: "low" | "medium" | "high"
    competingOffersRisk: "none" | "low" | "medium" | "high"
    keyIntel: string[]          // 3-5 bullet points drawn from conversation
    scoringRationale: string    // why they scored the negotiation position the way they did
  }
  principles: CoachPrinciple[]  // 3 primary principles for this deal
  playbook: CoachPlaybookStep[] // 5-6 ordered tactical steps
  walkAwayTriggers: string[]    // 4 concrete walk-away conditions
  roundScripts: CoachRoundScript[]
  objections: CoachObjection[]  // 6-8 common objections with calibrated responses
  copilot: CoachCopilotState
}

// ─────────────────────────────────────────────────────────────────────────────
// Copilot response (when vendor replies and sourcer pastes it in)
// ─────────────────────────────────────────────────────────────────────────────

export interface CopilotResponse {
  psychologicalRead: string       // What the message reveals about vendor state
  detectedCounterOffer: number | null
  recommendedNextRound: number | null
  urgencyUpdate: string           // Has urgency changed?
  nextMoveScript: string          // Exact reply to send
  timingAdvice: string            // When to send it
  warningFlags: string[]          // Any red flags in their message
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

interface CoachPromptInput {
  // Property
  propertyAddress: string
  propertyType: string | null
  bedrooms: number | null
  askingPrice: number
  // Offer engine
  strategy: "flip" | "hold" | "both"
  ceiling: number
  rungs: NegotiationRung[]
  refurbCost: number | null
  gdv: number | null
  monthlyRent: number | null
  grossYield: number | null
  // Vendor
  vendorName: string
  motivationScore: number | null
  urgencyLevel: string | null
  reasonForSelling: string | null
  timelineDays: number | null
  competingOffers: boolean
  // Conversation (last 8 messages for context)
  conversationSnippet: string
}

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

export function buildCoachSystemPrompt(): string {
  return `You are the world's most effective property negotiation coach. You combine the tactical frameworks of:

- **Chris Voss** (FBI hostage negotiator): Tactical empathy, mirroring, labelling emotions ("It seems like..."), calibrated questions ("How am I supposed to do that?"), accusation audits before anchoring, the "no" technique, late-night FM DJ voice for sensitive moments
- **Oren Klaff** (investment banker/author of Pitch Anything): Frame control — whoever sets the frame controls the negotiation. Prizing (be the buyer they want to impress, not the buyer who needs the deal). Status frames, moral authority frames, intrigue frames. Time pressure framing.
- **Roger Dawson** (author of Secrets of Power Negotiating): Tapering concessions (each step MUST be smaller than the last), the higher authority gambit ("I need to check with my business partner"), the reluctant buyer technique, the vice technique ("You'll have to do better than that"), good cop/bad cop.
- **UK property sourcing professionals** (Samuel Leeds, Rob Moore, Simon Zutshi): Motivated seller identification, BMV discipline, speed as a selling point, no-chain cash buyer framing, the "certainty premium."

CRITICAL RULES:
1. Scripts must sound natural and human — NOT corporate, NOT "salesy", NOT scripted-sounding
2. Every objection response must acknowledge first, then redirect with evidence (never argue directly)
3. Concession tapering is MANDATORY — each counter offer step must be visibly smaller than the last
4. The hard ceiling (Best & Final) is a MATHEMATICAL FACT, not a negotiating position — always frame it this way
5. UK English only: solicitors (not attorneys), exchange (not closing), completion, stamp duty, leasehold
6. Calibrate every script to the vendor's specific motivation type detected from their conversation
7. The negotiation score (0-100) reflects YOUR position strength, not the deal quality
8. Output ONLY valid JSON matching the exact schema. No markdown. No preamble. No explanation.`
}

export function buildCoachUserPrompt(input: CoachPromptInput): string {
  const {
    propertyAddress, propertyType, bedrooms, askingPrice,
    strategy, ceiling, rungs, refurbCost, gdv, monthlyRent, grossYield,
    vendorName, motivationScore, urgencyLevel, reasonForSelling, timelineDays, competingOffers,
    conversationSnippet,
  } = input

  const strategyLabel = strategy === "hold" ? "BRRR/BTL (Buy, Refurb, Refinance, Rent)" : strategy === "flip" ? "Flip" : "BRRR/BTL or Flip"
  const openingRung = rungs[0]
  const finalRung = rungs[rungs.length - 1]

  const rungLines = rungs.map(r =>
    `  Round ${r.round} (${r.label}): ${gbp(r.offerPrice)} · ${(r.discountPercent * 100).toFixed(1)}% below asking · ${(r.ceilingPercent * 100).toFixed(0)}% of ceiling${r.stepUpFromPrevious > 0 ? ` · +${gbp(r.stepUpFromPrevious)} from prev` : ""}`
  ).join("\n")

  const schema = `{
  "strategyName": "string (5-7 words, e.g. 'Speed Framing + Anchor Low')",
  "strategyRationale": "string (2-3 sentences explaining why this approach works for this specific vendor)",
  "negotiationScore": number (0-100, your position strength),
  "vendorProfile": {
    "motivationType": "financial_pressure|probate|relocation|divorce|downsizing|other",
    "motivationLabel": "string (e.g. 'Financial Pressure')",
    "motivationEmoji": "string (single emoji)",
    "motivationConfidence": number (0-100),
    "urgencySignal": "low|medium|high|very_high",
    "priceFlexibility": "low|medium|high",
    "competingOffersRisk": "none|low|medium|high",
    "keyIntel": ["string", "string", "string", "string", "string"] (5 specific insights from their conversation),
    "scoringRationale": "string (1 sentence explaining the negotiation score)"
  },
  "principles": [
    { "emoji": "string", "title": "string (3-5 words)", "description": "string (2-3 sentences)" },
    { "emoji": "string", "title": "string", "description": "string" },
    { "emoji": "string", "title": "string", "description": "string" }
  ],
  "playbook": [
    { "step": 1, "colour": "blue|amber|red", "title": "string", "body": "string (2-3 sentences of tactical advice)", "script": "string (optional — exact words to say/write, in quotes)" },
    { "step": 2, "colour": "blue|amber|red", "title": "string", "body": "string", "script": "string" },
    { "step": 3, "colour": "blue|amber|red", "title": "string", "body": "string" },
    { "step": 4, "colour": "blue|amber|red", "title": "string", "body": "string", "script": "string" },
    { "step": 5, "colour": "blue|amber|red", "title": "string", "body": "string", "script": "string" }
  ],
  "walkAwayTriggers": ["string", "string", "string", "string"],
  "roundScripts": [
    {
      "round": 0,
      "smsScript": "string (natural SMS message, 60-120 words, no Dear/Kind regards)",
      "callScript": "string (what to say verbally, first person, conversational)",
      "urgencyLever": "string (one tactical move to create gentle urgency)",
      "evidencePack": "string (the 3 key facts to cite as evidence for this price)",
      "coachTip": "string (optional inside tip for this specific round)"
    }
  ] (one entry per round — ${rungs.length} total),
  "objections": [
    {
      "emoji": "string",
      "title": "string (the objection itself, as the vendor would say it)",
      "whyTheySayIt": "string (1-2 sentences on the psychology behind this objection)",
      "response": "string (exact script in first person — what the sourcer says back)",
      "tags": ["string"] (1-3 tags like "use_evidence", "follow_with_speed", "acknowledge_first")
    }
  ] (6 objections calibrated to this vendor's motivation type),
  "copilot": {
    "currentRoundLabel": "string",
    "analysisPoints": ["string", "string", "string"],
    "suggestedFollowUp": "string (ready-to-send follow-up for if no reply after 6 hours)",
    "waitAdvice": "string"
  }
}`

  return `Generate a complete negotiation coach playbook for the following deal. Output ONLY the JSON.

=== DEAL DATA ===
Property: ${propertyAddress}
Type: ${bedrooms ? `${bedrooms}-bed ` : ""}${propertyType ?? "property"}
Asking price: ${gbp(askingPrice)}
Strategy: ${strategyLabel}
GDV (after refurb): ${gdv ? gbp(gdv) : "Not calculated"}
Monthly rent: ${monthlyRent ? gbp(monthlyRent) + "/mo" : "Not calculated"}
Gross yield: ${grossYield ? `${grossYield.toFixed(1)}%` : "Not calculated"}
Refurb estimate: ${refurbCost ? gbp(refurbCost) : "Not provided"}

=== NEGOTIATION LADDER ===
Ceiling (max viable purchase price): ${gbp(ceiling)}
Opening offer: ${openingRung ? gbp(openingRung.offerPrice) : "N/A"} (${openingRung ? `${(openingRung.discountPercent * 100).toFixed(1)}% below asking` : ""})
Best & Final: ${finalRung ? gbp(finalRung.offerPrice) : "N/A"} (hard ceiling — do not exceed)
Tapering steps:
${rungLines}

=== VENDOR DATA ===
Name: ${vendorName}
Motivation score: ${motivationScore !== null ? `${motivationScore}/10` : "Unknown"}
Urgency level: ${urgencyLevel ?? "Unknown"}
Reason for selling: ${reasonForSelling ?? "Not disclosed"}
Timeline: ${timelineDays ? `${timelineDays} days` : "Not specified"}
Competing offers reported: ${competingOffers ? "Yes" : "No"}

=== CONVERSATION HISTORY (last messages) ===
${conversationSnippet || "No conversation yet — cold approach."}

=== JSON SCHEMA TO FOLLOW ===
${schema}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Copilot prompt (when vendor replies)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCopilotPrompt(
  vendorMessage: string,
  currentRound: number,
  rungs: NegotiationRung[],
  ceiling: number,
  vendorMotivation: string,
): string {
  const nextRung = rungs.find(r => r.round === currentRound + 1)

  return `You are a world-class property negotiation coach. A vendor has responded in a live negotiation. Analyse their message and advise the sourcer on exactly what to do next.

Current negotiation round: ${currentRound} (${rungs[currentRound]?.label ?? "unknown"})
Ceiling (maximum we will ever pay): ${gbp(ceiling)}
Next rung available: ${nextRung ? `${gbp(nextRung.offerPrice)} (Round ${nextRung.round} — ${nextRung.label})` : "None — best & final already reached"}
Vendor motivation type: ${vendorMotivation}

VENDOR'S MESSAGE:
"${vendorMessage}"

Analyse this message using:
- Tactical empathy (what emotion is underneath their words?)
- Frame detection (are they trying to re-frame the negotiation?)
- Counter-offer detection (have they stated or implied a price?)
- Urgency signals (has their urgency increased or decreased?)

Output ONLY valid JSON:
{
  "psychologicalRead": "string (what this message really reveals — 2 sentences)",
  "detectedCounterOffer": number | null (extract any stated price, null if none),
  "recommendedNextRound": number | null (which rung to move to, null if hold position),
  "urgencyUpdate": "string (has their urgency changed and why)",
  "nextMoveScript": "string (exact SMS/message to send — conversational, natural, no corporate language)",
  "timingAdvice": "string (when to send — immediately / wait X hours / etc)",
  "warningFlags": ["string"] (any red flags like bluff language, aggression, walkaway signals)
}`
}
