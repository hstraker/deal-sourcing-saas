// lib/theme/status-colors.ts
// Single source of truth for all badge/status colour maps.
// Returns Tailwind class strings. Replace all local colour lookup maps with these.

/** Deal status badges — DealStatus enum values */
export function getDealStatusStyle(status: string): string {
  const map: Record<string, string> = {
    new:         "bg-gray-100 text-gray-800",
    review:      "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    ready:       "bg-purple-100 text-purple-800",
    listed:      "bg-green-100 text-green-800",
    reserved:    "bg-orange-100 text-orange-800",
    sold:        "bg-green-200 text-green-800",
    archived:    "bg-gray-200 text-gray-600",
  }
  return map[status] ?? "bg-gray-100 text-gray-800"
}

/** Pipeline stage badges — exact PipelineStage enum values */
export function getPipelineStageStyle(stage: string): string {
  const map: Record<string, string> = {
    NEW_LEAD:             "bg-blue-100 text-blue-700",
    AI_CONVERSATION:      "bg-violet-100 text-violet-700",
    DEAL_VALIDATION:      "bg-amber-100 text-amber-700",
    OFFER_MADE:           "bg-emerald-100 text-emerald-700",
    OFFER_ACCEPTED:       "bg-green-100 text-green-700",
    OFFER_REJECTED:       "bg-red-100 text-red-700",
    VIDEO_SENT:           "bg-cyan-100 text-cyan-700",
    RETRY_1:              "bg-orange-100 text-orange-700",
    RETRY_2:              "bg-orange-100 text-orange-700",
    RETRY_3:              "bg-orange-100 text-orange-700",
    PAPERWORK_SENT:       "bg-indigo-100 text-indigo-700",
    READY_FOR_INVESTORS:  "bg-purple-100 text-purple-700",
    DEAD_LEAD:            "bg-red-200 text-red-800",
  }
  return map[stage] ?? "bg-gray-100 text-gray-700"
}

/** Contact type badges — exact ContactType enum values */
export function getContactTypeStyle(type: string): string {
  const map: Record<string, string> = {
    SOLICITOR:        "bg-blue-100 text-blue-700",
    INVESTOR_CONTACT: "bg-purple-100 text-purple-700",
    VENDOR_CONTACT:   "bg-teal-100 text-teal-700",
    ESTATE_AGENT:     "bg-green-100 text-green-700",
    CONTRACTOR:       "bg-amber-100 text-amber-700",
    OTHER:            "bg-gray-100 text-gray-700",
  }
  return map[type] ?? "bg-gray-100 text-gray-700"
}

/** Investor strategy badges — includes border class for shadcn Badge variant="outline" */
export function getInvestorStrategyStyle(strategy: string): string {
  const map: Record<string, string> = {
    BRRRR: "bg-pink-100 text-pink-800 border-pink-200",
    BTL:   "bg-cyan-100 text-cyan-800 border-cyan-200",
    Flip:  "bg-orange-100 text-orange-800 border-orange-200",
    HMO:   "bg-purple-100 text-purple-800 border-purple-200",
    SA:    "bg-blue-100 text-blue-800 border-blue-200",
  }
  return map[strategy] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Investor experience level badges — includes border class */
export function getInvestorExperienceStyle(experience: string): string {
  const map: Record<string, string> = {
    beginner:     "bg-blue-100 text-blue-800 border-blue-200",
    intermediate: "bg-green-100 text-green-800 border-green-200",
    advanced:     "bg-purple-100 text-purple-800 border-purple-200",
  }
  return map[experience.toLowerCase()] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Investor pipeline stage chips — includes border class */
export function getInvestorPipelineStageStyle(stage: string): string {
  const map: Record<string, string> = {
    LEAD:          "bg-gray-100 text-gray-700 border-gray-200",
    CONTACTED:     "bg-blue-100 text-blue-700 border-blue-200",
    QUALIFIED:     "bg-green-100 text-green-700 border-green-200",
    VIEWING_DEALS: "bg-purple-100 text-purple-700 border-purple-200",
    RESERVED:      "bg-yellow-100 text-yellow-700 border-yellow-200",
    PURCHASED:     "bg-emerald-100 text-emerald-700 border-emerald-200",
    INACTIVE:      "bg-red-100 text-red-700 border-red-200",
  }
  return map[stage] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Reservation status chips — includes border class */
export function getReservationStatusStyle(status: string): string {
  const map: Record<string, string> = {
    pending:                "bg-gray-100 text-gray-700 border-gray-200",
    pack_sent:              "bg-blue-100 text-blue-700 border-blue-200",
    fee_pending:            "bg-yellow-100 text-yellow-700 border-yellow-200",
    fee_paid:               "bg-emerald-100 text-emerald-700 border-emerald-200",
    proof_of_funds_pending: "bg-orange-100 text-orange-700 border-orange-200",
    pof_received:           "bg-sky-100 text-sky-700 border-sky-200",
    lock_out_sent:          "bg-purple-100 text-purple-700 border-purple-200",
    locked_out:             "bg-violet-100 text-violet-700 border-violet-200",
  }
  return map[status] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Vendor analytics funnel stages (lowercase analytics keys, not PipelineStage enum) */
export function getAnalyticsFunnelStageStyle(stage: string): string {
  const map: Record<string, string> = {
    contacted:      "bg-blue-100 text-blue-800 border-blue-200",
    validated:      "bg-green-100 text-green-800 border-green-200",
    offer_made:     "bg-yellow-100 text-yellow-800 border-yellow-200",
    negotiating:    "bg-orange-100 text-orange-800 border-orange-200",
    offer_accepted: "bg-purple-100 text-purple-800 border-purple-200",
    offer_rejected: "bg-red-100 text-red-800 border-red-200",
    locked_out:     "bg-emerald-100 text-emerald-800 border-emerald-200",
    withdrawn:      "bg-gray-100 text-gray-800 border-gray-200",
  }
  return map[stage] ?? "bg-gray-100 text-gray-800 border-gray-200"
}
