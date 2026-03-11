// lib/deals/investor-matcher.ts

export interface InvestorCriteria {
  id: string
  name: string
  preferredAreas: string[]
  minBudget: number | null
  maxBudget: number | null
  minYield: number | null
  minBmv: number | null
  strategy: string[]
}

export interface DealForMatching {
  postcode: string | null
  askingPrice: number
  bmvPercentage: number | null
  grossYield: number | null
  recommendedStrategy: string | null
}

export interface MatchResult {
  investorId: string
  name: string
  /** 0–1 */
  score: number
  matched: string[]
  /** e.g. "BTL/BRRRR · SA1, SA2 · £60k–£100k" */
  criteriaLine: string
}

function dealStrategies(recommendedStrategy: string | null): string[] {
  if (recommendedStrategy === "flip") return ["Flip"]
  if (recommendedStrategy === "hold") return ["BTL", "BRRRR"]
  if (recommendedStrategy === "both") return ["Flip", "BTL", "BRRRR"]
  return []
}

export function matchInvestors(
  investors: InvestorCriteria[],
  deal: DealForMatching
): MatchResult[] {
  const results: MatchResult[] = []

  for (const investor of investors) {
    const checks: Array<{ label: string; pass: boolean }> = []

    // 1. Area
    if (investor.preferredAreas.length > 0 && deal.postcode) {
      const prefix = deal.postcode.split(" ")[0].toUpperCase()
      const pass = investor.preferredAreas.some((a) =>
        prefix.startsWith(a.toUpperCase())
      )
      checks.push({ label: "area", pass })
    }

    // 2. Budget (both bounds required)
    if (investor.minBudget !== null && investor.maxBudget !== null) {
      const pass =
        deal.askingPrice >= investor.minBudget &&
        deal.askingPrice <= investor.maxBudget
      checks.push({ label: "budget", pass })
    }

    // 3. BMV
    if (investor.minBmv !== null && deal.bmvPercentage !== null) {
      checks.push({ label: "BMV", pass: deal.bmvPercentage >= investor.minBmv })
    }

    // 4. Yield
    if (investor.minYield !== null && deal.grossYield !== null) {
      checks.push({ label: "yield", pass: deal.grossYield >= investor.minYield })
    }

    // 5. Strategy (only checked when deal has a known strategy value)
    if (investor.strategy.length > 0 && deal.recommendedStrategy) {
      const ds = dealStrategies(deal.recommendedStrategy)
      // ds is empty when recommendedStrategy is an unknown value (e.g. "both", "pass")
      // — skip the criterion rather than always failing it
      if (ds.length > 0) {
        const pass = ds.some((s) => investor.strategy.includes(s))
        checks.push({ label: "strategy", pass })
      }
    }

    if (checks.length === 0) continue

    const matchedLabels = checks.filter((c) => c.pass).map((c) => c.label)
    const score = matchedLabels.length / checks.length
    if (score === 0) continue

    // Build one-line criteria summary
    const parts: string[] = []
    if (investor.strategy.length > 0) parts.push(investor.strategy.join("/"))
    if (investor.preferredAreas.length > 0)
      parts.push(investor.preferredAreas.join(", "))
    if (investor.minBudget !== null && investor.maxBudget !== null) {
      const min = (investor.minBudget / 1000).toFixed(0)
      const max = (investor.maxBudget / 1000).toFixed(0)
      parts.push(`£${min}k–£${max}k`)
    }

    results.push({
      investorId: investor.id,
      name: investor.name,
      score,
      matched: matchedLabels,
      criteriaLine: parts.join(" · "),
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
