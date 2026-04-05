"use client"

import { useState } from "react"
import { X, Loader2, Calculator, CheckCircle, XCircle, Home, ChevronDown, ChevronRight, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ──────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

function calcOpening(ceiling: number): number {
  return Math.round((ceiling * 0.88) / 50) * 50
}

function parseStrategy(notes: string | null): string | null {
  if (!notes) return null
  const m = notes.match(/Strategy:\s*([A-Z\/]+)/i)
  return m ? m[1].toUpperCase() : null
}

// ─── accordion wrapper ────────────────────────────────────────────────────────

function Accordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{title}</span>
          {badge}
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  )
}

function PassBadge({ pass }: { pass: boolean | null }) {
  if (pass === null) return null
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-[10px] font-bold",
      pass ? "bg-green-100 text-green-700 border border-green-200"
           : "bg-red-100 text-red-700 border border-red-200"
    )}>
      {pass ? "✓ PASS" : "✗ FAIL"}
    </span>
  )
}

// ─── section parsers ──────────────────────────────────────────────────────────

/**
 * Extract [STRATEGY_DATA]{...}[/STRATEGY_DATA] JSON from text.
 * Returns parsed data and text with the block removed.
 */
function extractStrategyData(text: string): {
  cleaned: string
  strategies: Array<{
    key: string; name: string; emoji: string
    maxViable?: number | null
    maxOffer?: number; yield?: number | null
    recommendedOffer?: number
    yieldAtOffer?: number | null
    flipProfit?: number | null; flipMargin?: number | null
    brrProceeds?: number | null; brrLeftIn?: number | null
    viable: boolean
    tooltips?: { maxViable?: string | null; atRecOffer?: string | null; viable?: string | null }
  }> | null
  recommended: string | null
} {
  const match = text.match(/\[STRATEGY_DATA\]([\s\S]*?)\[\/STRATEGY_DATA\]/i)
  if (!match) return { cleaned: text, strategies: null, recommended: null }

  let strategies = null
  let recommended = null
  try {
    const json = JSON.parse(match[1].trim())
    strategies = json.strategies ?? null
    recommended = json.recommended ?? null
  } catch {}

  const cleaned = text.replace(/\[STRATEGY_DATA\][\s\S]*?\[\/STRATEGY_DATA\]/i, "").trim()
  return { cleaned, strategies, recommended }
}

/**
 * Split raw text into named sections by emoji-prefixed MAJOR section headers only.
 * Data lines like "📖 £200,000 | 🛏 0 BED" or "📖 MONTHLY RENT: £1,244" are NOT
 * treated as headers — they stay inside the current section body.
 */
const MAJOR_SECTION_KEYWORDS = [
  "DEAL FAILED", "DEAL PASSED", "DEAL VALIDATION",
  "STRATEGY-AWARE", "OFFER CALCULATION",
  "COMPARABLE PROPERT",
  "LAND REGISTRY", "OWNERSHIP",
  "RENTAL YIELD", "RENTAL ANALYSIS",
  "BMV ANALYSIS",
]
const STRATEGY_HEADER_KEYWORDS = /^(BTL|BUY.TO.LET|BUY\s*&\s*HOLD|BUYHOLD|FLIP|BRRR|BRR)\b/i

function isMajorSectionHeader(line: string): boolean {
  // Strip leading emoji / punctuation, get the text content
  const text = line.replace(/^[\s\S]{0,3}/, "").trim().toUpperCase()
  const full = line.toUpperCase()
  return (
    MAJOR_SECTION_KEYWORDS.some(kw => full.includes(kw)) ||
    STRATEGY_HEADER_KEYWORDS.test(text)
  )
}

function splitSections(text: string): Array<{ header: string; body: string[] }> {
  const sections: Array<{ header: string; body: string[] }> = []
  let current: { header: string; body: string[] } | null = null

  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue

    if (isMajorSectionHeader(line)) {
      if (current) sections.push(current)
      current = { header: line, body: [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) sections.push(current)
  return sections
}

/** Parse numbered step lines from a body array */
function parseSteps(lines: string[]): Array<{ num: string; text: string; sub: string | null }> {
  const steps: Array<{ num: string; text: string; sub: string | null }> = []
  for (const line of lines) {
    const numMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      steps.push({ num: numMatch[1], text: numMatch[2], sub: null })
    } else if (steps.length > 0 && (line.toLowerCase().startsWith("rationale:") || /^\s{4,}/.test(line))) {
      steps[steps.length - 1].sub = line.trim()
    }
  }
  return steps
}

/** Parse KV pairs from a body (e.g. "Strategy: BTL") */
function parseKV(lines: string[]): Array<{ key: string; val: string }> {
  return lines
    .map(line => {
      const m = line.match(/^([^:]{1,40}):\s+(.+)/)
      return m ? { key: m[1].trim(), val: m[2].trim() } : null
    })
    .filter(Boolean) as Array<{ key: string; val: string }>
}

/** Parse bullet lines starting with "•" */
function parseBullets(lines: string[]): string[] {
  return lines
    .filter(l => l.startsWith("•") || l.startsWith("-") || l.startsWith("*"))
    .map(l => l.replace(/^[•\-\*]\s*/, "").trim())
    .filter(Boolean)
}

/** Parse comparable property blocks */
interface Comp { address: string; price: string; beds: string; date: string; dist: string }
function parseComparables(lines: string[]): Comp[] {
  const comps: Comp[] = []
  let currentAddress = ""
  for (const line of lines) {
    // Address lines: "1   14, Marston Road, B29 5ND" or "1. 14, Marston..."
    const addrMatch = line.match(/^\d+[.\s]+\s*(.+)/)
    if (addrMatch) {
      currentAddress = addrMatch[1].trim()
      continue
    }
    // Detail line: "📖 £200,000 | 🛏 0 BED | 📅 JAN 2026 | 0.1 MI"
    if (currentAddress && (line.includes("£") || line.includes("|"))) {
      const parts = line.split("|").map(p => p.trim())
      const price = parts.find(p => p.includes("£"))?.replace(/[^\d£,]/g, "").trim() ?? "—"
      const beds  = parts.find(p => /BED/i.test(p))?.replace(/[^\d]/g, "") ?? "?"
      const date  = parts.find(p => /\d{4}/.test(p) && !/£/.test(p))?.replace(/[^A-Z0-9 ]/gi, "").trim() ?? "—"
      const dist  = parts.find(p => /MI/i.test(p))?.replace(/[^0-9.]/g, "") ?? "—"
      comps.push({ address: currentAddress, price: `£${price.replace("£","")}`, beds, date, dist: `${dist}mi` })
      currentAddress = ""
    }
  }
  return comps
}

/** Parse strategy sub-sections (BTL, FLIP, BRRR inline blocks) */
interface StrategyInline { name: string; maxOffer: string; yield: string; viable: boolean | null }
function parseInlineStrategies(lines: string[]): StrategyInline[] {
  const strategies: StrategyInline[] = []
  const STRATEGY_HEADER_RE = /^[🏠🔨🔄🏗📝💼]\s*(BTL|Buy.to.Let|Buy\s*&\s*Hold|BuyHold|FLIP|Flip|BRRR|BRR)/i

  let current: StrategyInline | null = null
  for (const line of lines) {
    if (STRATEGY_HEADER_RE.test(line)) {
      if (current) strategies.push(current)
      const name = line.replace(/^[^\w]*/, "").trim()
      current = { name, maxOffer: "—", yield: "—", viable: null }
    } else if (current && line.includes("Max Offer")) {
      const offerM = line.match(/Max Offer[:\s]+([£\d,]+)/i)
      const yieldM = line.match(/Yield[:\s]+([\d.]+)%/i)
      const viableM = line.match(/✅\s*Viable|viable/i)
      const notViableM = line.match(/❌\s*Not Viable|not viable/i)
      if (offerM) current.maxOffer = offerM[1]
      if (yieldM) current.yield = `${yieldM[1]}%`
      if (viableM) current.viable = true
      if (notViableM) current.viable = false
    }
  }
  if (current) strategies.push(current)
  return strategies
}

/** Extract rent/yield KPI values */
interface RentKPIs { monthly: string | null; weekly: string | null; annual: string | null; grossYield: string | null }
function parseRentKPIs(lines: string[]): RentKPIs {
  const find = (re: RegExp) => {
    for (const l of lines) {
      const m = l.match(re)
      if (m) return m[1]
    }
    return null
  }
  return {
    monthly:    find(/MONTHLY RENT[:\s]+(£[\d,]+)/i),
    weekly:     find(/WEEKLY RENT[:\s]+(£[\d,]+)/i),
    annual:     find(/ANNUAL RENT[:\s]+(£[\d,]+)/i),
    grossYield: find(/GROSS YIELD[:\s]+([\d.]+%(?:\s*\([^)]*\))?)/i),
  }
}

// ─── section renderers ────────────────────────────────────────────────────────

function StepsRenderer({ steps }: { steps: Array<{ num: string; text: string; sub: string | null }> }) {
  if (!steps.length) return null
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
            {s.num}
          </span>
          <div>
            <p className="text-xs text-gray-700 leading-snug">{s.text}</p>
            {s.sub && <p className="mt-0.5 text-[11px] text-gray-400 italic">{s.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function KVRenderer({ pairs }: { pairs: Array<{ key: string; val: string }> }) {
  if (!pairs.length) return null
  return (
    <div className="space-y-1">
      {pairs.map((p, i) => (
        <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-gray-500 shrink-0">{p.key}</span>
          <span className="font-semibold text-gray-800 text-right">{p.val}</span>
        </div>
      ))}
    </div>
  )
}

function CompsRenderer({ comps }: { comps: Comp[] }) {
  if (!comps.length) return <p className="text-xs text-gray-400">No comparables found</p>
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 py-1.5 text-left font-semibold text-gray-600 w-5">#</th>
            <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Address</th>
            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Price</th>
            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Beds</th>
            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Date</th>
            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Dist</th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c, i) => (
            <tr key={i} className={cn("border-b border-gray-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
              <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
              <td className="px-3 py-1.5 text-gray-700 max-w-[160px] truncate">{c.address}</td>
              <td className="px-3 py-1.5 text-right font-semibold text-gray-800">{c.price}</td>
              <td className="px-3 py-1.5 text-right text-gray-500">{c.beds}</td>
              <td className="px-3 py-1.5 text-right text-gray-500">{c.date}</td>
              <td className="px-3 py-1.5 text-right text-gray-500">{c.dist}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── small tooltip helper ─────────────────────────────────────────────────────

function CalcTooltip({ tip, children }: { tip: string | null | undefined; children: React.ReactNode }) {
  if (!tip) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[260px] text-[11px] leading-snug whitespace-pre-line bg-gray-900 text-gray-100 border-gray-700 shadow-xl"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}

function StrategyTableRenderer({
  strategies,
  recommended,
}: {
  strategies: Array<{
    key: string; name: string; emoji: string
    maxViable?: number | null
    recommendedOffer?: number
    yieldAtOffer?: number | null
    flipProfit?: number | null; flipMargin?: number | null
    brrProceeds?: number | null; brrLeftIn?: number | null
    viable: boolean
    tooltips?: {
      maxViable?: string | null
      atRecOffer?: string | null
      viable?: string | null
    }
    // legacy fallback fields
    maxOffer?: number; yield?: number | null
  }> | null
  inlineStrategies: StrategyInline[]
  recommended: string | null
}) {
  if (!strategies?.length) return null

  const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`

  const metricCell = (s: typeof strategies[0]) => {
    const tip = s.tooltips?.atRecOffer

    if (s.key === "BTL" || s.key === "BuyHold") {
      const y = s.yieldAtOffer ?? s.yield
      return y != null ? (
        <CalcTooltip tip={tip}>
          <span className={y >= 8 ? "text-green-600 font-semibold" : y >= 6 ? "text-amber-600 font-semibold" : "text-red-500 font-semibold"}>
            {y.toFixed(1)}% yield
          </span>
          <Info className="h-3 w-3 text-gray-400 shrink-0" />
        </CalcTooltip>
      ) : <span className="text-gray-300">—</span>
    }

    if (s.key === "Flip") {
      return s.flipProfit != null ? (
        <CalcTooltip tip={tip}>
          <div className="text-right leading-tight">
            <div className={s.flipProfit > 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
              {fmt(s.flipProfit)} profit
            </div>
            {s.flipMargin != null && (
              <div className="text-[10px] text-gray-400">{s.flipMargin.toFixed(1)}% ROI</div>
            )}
          </div>
          <Info className="h-3 w-3 text-gray-400 shrink-0 self-start mt-0.5" />
        </CalcTooltip>
      ) : <span className="text-gray-300">—</span>
    }

    if (s.key === "BRR") {
      return s.brrLeftIn != null ? (
        <CalcTooltip tip={tip}>
          <div className="text-right leading-tight">
            <div className={s.brrLeftIn === 0 ? "text-green-600 font-semibold" : s.brrLeftIn < 15000 ? "text-amber-600 font-semibold" : "text-gray-700 font-semibold"}>
              {fmt(s.brrLeftIn)} left in
            </div>
            {s.brrProceeds != null && (
              <div className="text-[10px] text-gray-400">refi: {fmt(s.brrProceeds)}</div>
            )}
          </div>
          <Info className="h-3 w-3 text-gray-400 shrink-0 self-start mt-0.5" />
        </CalcTooltip>
      ) : <span className="text-gray-300">—</span>
    }

    return <span className="text-gray-300">—</span>
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Strategy</th>
              <th className="px-3 py-1.5 text-right font-semibold text-gray-600">
                Max Viable Price
                <div className="text-[9px] font-normal text-gray-400 normal-case">ceiling per strategy</div>
              </th>
              <th className="px-3 py-1.5 text-right font-semibold text-gray-600">
                At Rec. Offer
                <div className="text-[9px] font-normal text-gray-400 normal-case">yield/profit if offer accepted</div>
              </th>
              <th className="px-3 py-1.5 text-right font-semibold text-gray-600">
                Viable
                <div className="text-[9px] font-normal text-gray-400 normal-case">offer ≤ ceiling?</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s, i) => {
              const ceiling = s.maxViable ?? s.maxOffer ?? null
              return (
                <tr key={s.key} className={cn(
                  "border-b border-gray-100 last:border-0",
                  s.key === recommended ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                )}>
                  {/* Strategy name */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{s.name}</span>
                      {s.key === recommended && (
                        <span className="rounded-full bg-blue-100 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          REC
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Max Viable Price — with formula tooltip */}
                  <td className="px-3 py-2 text-right font-bold text-gray-900">
                    {ceiling != null ? (
                      <CalcTooltip tip={s.tooltips?.maxViable}>
                        <span>{fmt(ceiling)}</span>
                        <Info className="h-3 w-3 text-gray-400 shrink-0" />
                      </CalcTooltip>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* At Rec. Offer metric */}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end">
                      {metricCell(s)}
                    </div>
                  </td>

                  {/* Viable — with explanation tooltip */}
                  <td className="px-3 py-2 text-right">
                    <CalcTooltip tip={s.tooltips?.viable}>
                      {s.viable
                        ? <span className="text-green-600 font-semibold">✓ Yes</span>
                        : <span className="text-red-500 font-semibold">✗ No</span>
                      }
                      <Info className="h-3 w-3 text-gray-400 shrink-0" />
                    </CalcTooltip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-400 flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0" />
          Hover any value to see how it was calculated. Max Viable Price = ceiling per strategy. Viable = rec. offer ≤ ceiling.
        </div>
      </div>
    </TooltipProvider>
  )
}

function RentKPIRenderer({
  kpis,
  bullets,
  rawBody,
}: {
  kpis: RentKPIs
  bullets: string[]
  rawBody?: string[]
}) {
  const hasKpis = kpis.monthly || kpis.annual || kpis.weekly || kpis.grossYield

  // Fallback: if KPI parsing found nothing but we have raw body lines, display them
  // as readable bullet points so the data is never silently hidden
  if (!hasKpis && (!bullets.length) && rawBody?.length) {
    return (
      <div className="space-y-1">
        {rawBody
          .filter(l => l.trim() && !/^={3,}/.test(l) && !/^-{3,}/.test(l))
          .map((line, i) => {
            // Strip leading emoji (surrogate pairs = 2 JS chars)
            const clean = line.replace(/^[\s\S]{0,3}/, "").trim()
            return <p key={i} className="text-xs text-gray-700">• {clean || line.trim()}</p>
          })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {hasKpis && (
        <div className="grid grid-cols-2 gap-2">
          {kpis.monthly && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-0.5">Monthly Rent</p>
              <p className="text-sm font-bold text-gray-900">{kpis.monthly}</p>
            </div>
          )}
          {kpis.annual && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-0.5">Annual Rent</p>
              <p className="text-sm font-bold text-gray-900">{kpis.annual}</p>
            </div>
          )}
          {kpis.weekly && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-0.5">Weekly Rent</p>
              <p className="text-sm font-bold text-gray-900">{kpis.weekly}</p>
            </div>
          )}
          {kpis.grossYield && (
            <div className={cn(
              "rounded-lg border p-2.5 text-center",
              kpis.grossYield.includes("STRONG") || parseFloat(kpis.grossYield) >= 7
                ? "border-green-200 bg-green-50"
                : parseFloat(kpis.grossYield) >= 5
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
            )}>
              <p className="text-[10px] text-gray-500 mb-0.5">Gross Yield</p>
              <p className={cn(
                "text-sm font-bold",
                kpis.grossYield.includes("STRONG") || parseFloat(kpis.grossYield) >= 7
                  ? "text-green-700"
                  : parseFloat(kpis.grossYield) >= 5
                  ? "text-amber-700"
                  : "text-red-700"
              )}>
                {kpis.grossYield.split("(")[0].trim()}
              </p>
            </div>
          )}
        </div>
      )}
      {bullets.length > 0 && (
        <div className="space-y-1">
          {bullets.map((b, i) => (
            <p key={i} className="text-xs text-gray-600">• {b}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── main notes renderer ──────────────────────────────────────────────────────

function ValidationNotesRenderer({ notes }: { notes: string }) {
  // 1. Extract and remove [STRATEGY_DATA] block
  const { cleaned, strategies, recommended } = extractStrategyData(notes)

  // 2. Split into raw sections
  const rawSections = splitSections(cleaned)

  // 3. Classify and render each section
  const rendered: React.ReactNode[] = []

  // Collect all "inline strategy" lines for the strategy table fallback
  const allStrategyLines: string[] = []
  let offerCalcSection: typeof rawSections[0] | null = null
  let comparablesSection: typeof rawSections[0] | null = null
  let landRegSection: typeof rawSections[0] | null = null
  let rentalSection: typeof rawSections[0] | null = null
  let bmvSection: typeof rawSections[0] | null = null
  const strategyInlineSections: typeof rawSections[0][] = []

  for (const sec of rawSections) {
    const h = sec.header.toUpperCase()

    if (h.includes("DEAL FAILED") || h.includes("DEAL PASSED") || h.includes("DEAL VALIDATION")) {
      // Skip — verdict is already shown prominently on the left panel
      continue
    } else if (h.includes("STRATEGY-AWARE") || h.includes("OFFER CALCULATION")) {
      offerCalcSection = sec
    } else if (h.includes("COMPARABLE")) {
      comparablesSection = sec
    } else if (h.includes("LAND REGISTRY") || h.includes("OWNERSHIP")) {
      landRegSection = sec
    } else if (h.includes("RENTAL YIELD") || h.includes("RENTAL ANALYSIS")) {
      rentalSection = sec
    } else if (h.includes("BMV ANALYSIS")) {
      bmvSection = sec
    } else if (/BTL|BUY.TO.LET|FLIP|BRRR|BRR|BUY\s*&\s*HOLD|BUYHOLD/.test(h)) {
      strategyInlineSections.push(sec)
      allStrategyLines.push(sec.header, ...sec.body)
    }
  }

  // ── Offer Calculation section ─────────────────────────────────────────────
  if (offerCalcSection) {
    const allLines = offerCalcSection.body
    const kvLines = allLines.filter(l => /^[A-Za-z\s]+:\s/.test(l) && !l.match(/^\d+\./))
    const steps = parseSteps(allLines)
    const kvPairs = parseKV(kvLines)

    rendered.push(
      <Accordion key="offer" title="Offer Calculation" defaultOpen>
        {kvPairs.length > 0 && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <KVRenderer pairs={kvPairs} />
          </div>
        )}
        <StepsRenderer steps={steps} />
      </Accordion>
    )
  }

  // ── Strategy Comparison section ───────────────────────────────────────────
  const inlineStrategies = parseInlineStrategies(allStrategyLines)
  const hasStrategyData = (strategies && strategies.length > 0) || inlineStrategies.length > 0
  if (hasStrategyData) {
    rendered.push(
      <Accordion key="strategies" title="Strategy Comparison" defaultOpen>
        <StrategyTableRenderer
          strategies={strategies}
          inlineStrategies={inlineStrategies}
          recommended={recommended}
        />
      </Accordion>
    )
  }

  // ── Comparable Properties section ─────────────────────────────────────────
  if (comparablesSection) {
    const comps = parseComparables(comparablesSection.body)
    rendered.push(
      <Accordion key="comps" title={`Comparable Properties${comps.length ? ` (${comps.length})` : ""}`}>
        <CompsRenderer comps={comps} />
      </Accordion>
    )
  }

  // ── Land Registry section ─────────────────────────────────────────────────
  if (landRegSection) {
    const bullets = parseBullets(landRegSection.body)
    const extras = landRegSection.body.filter(l => !l.startsWith("•") && !l.startsWith("-") && !l.startsWith("*") && l.trim())
    rendered.push(
      <Accordion key="land" title="Land Registry Ownership">
        <div className="space-y-1">
          {[...extras, ...bullets].map((b, i) => (
            <p key={i} className="text-xs text-gray-700">
              {b.startsWith("•") ? b : `• ${b}`}
            </p>
          ))}
        </div>
      </Accordion>
    )
  }

  // ── Rental Yield section ──────────────────────────────────────────────────
  if (rentalSection) {
    // Parse KPIs from the FULL cleaned text — the section body may be incomplete
    // if emoji-prefixed data lines were not captured during section splitting.
    // Rent patterns (MONTHLY RENT, ANNUAL RENT, etc.) are unique enough that
    // scanning the full text won't produce false positives.
    const fullLines = cleaned.split("\n").map(l => l.trim()).filter(Boolean)
    const kpis = parseRentKPIs(fullLines)
    const bullets = parseBullets(rentalSection.body)
    const hasPass = rentalSection.header.includes("✅") || rentalSection.header.toUpperCase().includes("PASS")
    const hasFail = rentalSection.header.includes("❌") || rentalSection.header.toUpperCase().includes("FAIL")

    rendered.push(
      <Accordion
        key="rental"
        title="Rental Yield Analysis"
        badge={<PassBadge pass={hasPass ? true : hasFail ? false : null} />}
        defaultOpen
      >
        <RentKPIRenderer kpis={kpis} bullets={bullets} rawBody={rentalSection.body} />
      </Accordion>
    )
  }

  // ── BMV Analysis section ──────────────────────────────────────────────────
  if (bmvSection) {
    const hasPass = bmvSection.header.includes("✅") || bmvSection.header.toUpperCase().includes("PASS")
    const hasFail = bmvSection.header.includes("❌") || bmvSection.header.toUpperCase().includes("FAIL")
    const bullets = parseBullets(bmvSection.body)
    const others = bmvSection.body.filter(l => !l.startsWith("•") && !l.startsWith("-") && l.trim())

    rendered.push(
      <Accordion
        key="bmv"
        title="BMV Analysis"
        badge={<PassBadge pass={hasPass ? true : hasFail ? false : null} />}
      >
        <div className="space-y-1">
          {[...others, ...bullets].filter(Boolean).map((b, i) => (
            <p key={i} className="text-xs text-gray-700">• {b.replace(/^[•\-]\s*/, "")}</p>
          ))}
        </div>
      </Accordion>
    )
  }

  if (rendered.length === 0) {
    // Fallback — just show text nicely
    return (
      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {cleaned}
      </div>
    )
  }

  return <div className="space-y-2">{rendered}</div>
}

// ─── component ────────────────────────────────────────────────────────────────

export function ValidationModal({
  lead,
  onClose,
  onCheck,
}: {
  lead: VendorLead
  onClose: () => void
  onCheck?: () => Promise<void>
}) {
  const [checking, setChecking] = useState(false)

  const bmv     = toNum(lead.bmvScore)
  const profit  = toNum(lead.profitPotential)
  const offer   = toNum(lead.offerAmount)
  const refurb  = toNum(lead.estimatedRefurbCost)
  const opening = offer ? calcOpening(offer) : null
  const strategy = parseStrategy(lead.validationNotes)
  const passed  = lead.validationPassed

  // ── Left panel ───────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col overflow-y-auto p-5 gap-0">

      {/* Property */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? lead.vendorName}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          {lead.propertyPostcode ?? ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
          {lead.tenureType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.tenureType}
            </span>
          )}
        </div>
      </div>

      {/* Verdict */}
      <div className="mb-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Validation Result
        </p>
        {passed === true && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-center">
            <CheckCircle className="h-7 w-7 text-green-400 mx-auto mb-1.5" />
            <p className="text-xl font-extrabold text-green-400 leading-none">PASSED</p>
            <p className="mt-1 text-[10px] text-green-300">Deal meets investment criteria</p>
          </div>
        )}
        {passed === false && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
            <XCircle className="h-7 w-7 text-red-400 mx-auto mb-1.5" />
            <p className="text-xl font-extrabold text-red-400 leading-none">FAILED</p>
            <p className="mt-1 text-[10px] text-red-300">Does not meet criteria</p>
          </div>
        )}
        {passed === null && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <Calculator className="h-7 w-7 text-slate-500 mx-auto mb-1.5" />
            <p className="text-lg font-extrabold text-slate-400 leading-none">NOT RUN</p>
            <p className="mt-1 text-[10px] text-slate-500">Calculate BMV to validate</p>
          </div>
        )}
      </div>

      {/* Recommended offer */}
      {offer && (
        <div className="mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Recommended Offer
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-center">
              <p className="text-[9px] text-slate-500 mb-0.5">Opening</p>
              <p className="text-sm font-bold text-slate-100">{fmtCurrency(opening)}</p>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-center">
              <p className="text-[9px] text-blue-400 mb-0.5">Max Ceiling</p>
              <p className="text-sm font-bold text-blue-300">{fmtCurrency(offer)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 h-px bg-white/10" />

      {/* Deal metrics */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Deal Metrics</p>

        {strategy && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Strategy</span>
            <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
              {strategy}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-semibold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Market Value</span>
          <span className="font-semibold text-slate-100">{fmtCurrency(lead.estimatedMarketValue)}</span>
        </div>
        {bmv !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">BMV Discount</span>
            <span className={cn("font-bold", bmv >= 20 ? "text-green-400" : bmv >= 10 ? "text-amber-400" : "text-red-400")}>
              {bmv.toFixed(1)}%
              {bmv < 20 && <span className="ml-1 text-[10px] font-normal text-slate-500">(below 20%)</span>}
            </span>
          </div>
        )}
        {profit !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Profit Potential</span>
            <span className={cn("font-bold", profit > 0 ? "text-green-400" : "text-red-400")}>
              {fmtCurrency(profit)}
            </span>
          </div>
        )}
        {refurb !== null && refurb > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Refurb Cost</span>
            <span className="font-semibold text-amber-400">{fmtCurrency(refurb)}</span>
          </div>
        )}
        {lead.estimatedMonthlyRent && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Est. Monthly Rent</span>
            <span className="font-semibold text-slate-100">{fmtCurrency(lead.estimatedMonthlyRent)}/mo</span>
          </div>
        )}
      </div>

      {/* Pipeline stage */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  // ── Right panel ───────────────────────────────────────────────────────────

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="4xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 shrink-0">
        <div>
          <p className="text-sm font-bold text-gray-900">Validation Notes</p>
          <p className="text-xs text-gray-400">
            {lead.validationNotes
              ? lead.bmvValidatedAt
                ? `Calculated ${new Date(lead.bmvValidatedAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}`
                : "Validation complete"
              : "No validation run yet"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {lead.validationNotes ? (
          <ValidationNotesRenderer notes={lead.validationNotes} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Home className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No Validation Run Yet</p>
            <p className="text-xs text-gray-400 mb-6">
              Calculate BMV to analyse this deal and get a full validation report
            </p>
            {onCheck && (
              <button
                onClick={async () => {
                  setChecking(true)
                  try { await onCheck() } finally { setChecking(false) }
                }}
                disabled={checking}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                {checking ? "Calculating…" : "Calculate BMV"}
              </button>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
