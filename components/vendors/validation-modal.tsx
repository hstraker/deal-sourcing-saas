"use client"

import { useState } from "react"
import { X, Loader2, Calculator, CheckCircle, XCircle, Home, ChevronDown, ChevronRight, Info, Camera, AlertTriangle, TrendingDown, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import type { VendorLead } from "./vendor-leads-table"
import { AcquisitionCostPanel } from "./acquisition-cost-panel"
import { LeftPanelPhotoThumbs, PhotoConditionCard } from "./lead-photo-strip"

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

function PassBadge({ pass }: { pass: boolean | null | "negotiate" }) {
  if (pass === null) return null
  if (pass === "negotiate")
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
        ⚠ NEGOTIATE
      </span>
    )
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
    const hasPass      = rentalSection.header.includes("✅") || rentalSection.header.toUpperCase().includes("PASS")
    const hasFail      = rentalSection.header.includes("❌") || rentalSection.header.toUpperCase().includes("FAIL")
    const hasNegRental = rentalSection.header.includes("⚠️") || rentalSection.header.toUpperCase().includes("NEGOTIATE")
    const rentalBadge: boolean | null | "negotiate" =
      hasPass ? true : hasNegRental ? "negotiate" : hasFail ? false : null

    rendered.push(
      <Accordion
        key="rental"
        title="Rental Yield Analysis"
        badge={<PassBadge pass={rentalBadge} />}
        defaultOpen
      >
        <RentKPIRenderer kpis={kpis} bullets={bullets} rawBody={rentalSection.body} />
      </Accordion>
    )
  }

  // ── BMV Analysis section ──────────────────────────────────────────────────
  if (bmvSection) {
    const hasPass      = bmvSection.header.includes("✅") || bmvSection.header.toUpperCase().includes("PASS")
    const hasFail      = bmvSection.header.includes("❌") || bmvSection.header.toUpperCase().includes("FAIL")
    const hasNegotiate = bmvSection.header.includes("⚠️") || bmvSection.header.toUpperCase().includes("NEGOTIATE")
    const bmvBadgeVal: boolean | null | "negotiate" =
      hasPass ? true : hasNegotiate ? "negotiate" : hasFail ? false : null
    const bullets = parseBullets(bmvSection.body)
    const others = bmvSection.body.filter(l => !l.startsWith("•") && !l.startsWith("-") && l.trim())

    rendered.push(
      <Accordion
        key="bmv"
        title="BMV Analysis"
        badge={<PassBadge pass={bmvBadgeVal} />}
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

// ─── sourcer summary generator ───────────────────────────────────────────────

type SourcingVerdict = "strong_buy" | "buy" | "negotiate" | "avoid"

interface SourcerSummary {
  verdict: SourcingVerdict
  headline: string
  body: string
  action: string
}

function buildSourcerSummary(lead: {
  validationPassed: boolean | null
  bmvScore: string | number | null
  profitPotential: string | number | null
  offerAmount: string | number | null
  estimatedMarketValue: string | number | null
  askingPrice: string | number | null
  estimatedMonthlyRent: string | number | null
  estimatedAnnualRent: string | number | null
  estimatedRefurbCost: string | number | null
  motivationScore: number | null
  urgencyLevel: string | null
  timelineDays: number | null
  reasonForSelling: string | null
  condition: string | null
  competingOffers: boolean
  validationNotes: string | null
}): SourcerSummary | null {
  if (!lead.validationNotes) return null

  const n = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "") return null
    const x = typeof v === "number" ? v : parseFloat(String(v))
    return isNaN(x) ? null : x
  }
  const gbp = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`

  const bmv        = n(lead.bmvScore)
  const profit     = n(lead.profitPotential)
  const asking     = n(lead.askingPrice)
  const marketVal  = n(lead.estimatedMarketValue)
  const offer      = n(lead.offerAmount)
  const rent       = n(lead.estimatedMonthlyRent)
  const annualRent = n(lead.estimatedAnnualRent) ?? (rent ? rent * 12 : null)
  const refurb     = n(lead.estimatedRefurbCost)
  const motivation = lead.motivationScore
  const passed     = lead.validationPassed

  // Pull validated strategy data from notes
  const stratMatch = lead.validationNotes.match(/\[STRATEGY_DATA\]([\s\S]*?)\[\/STRATEGY_DATA\]/i)
  let validatedStrategies: Array<{
    key: string; viable: boolean
    maxViable: number | null; recommendedOffer: number | null
    yieldAtOffer: number | null; flipProfit: number | null
    brrProceeds: number | null; brrLeftIn: number | null
  }> | null = null
  let recommended: string | null = null
  if (stratMatch) {
    try {
      const j = JSON.parse(stratMatch[1].trim())
      validatedStrategies = j.strategies ?? null
      recommended = j.recommended ?? null
    } catch {}
  }

  const vs = (key: string) => validatedStrategies?.find(s => s.key === key) ?? null
  const btl  = vs("BTL")
  const flip = vs("Flip")
  const brr  = vs("BRR")
  const bh   = vs("BuyHold")

  const viableStrategies = validatedStrategies?.filter(s => s.viable) ?? []
  const hasViable = viableStrategies.length > 0

  // ── Leverage signals ─────────────────────────────────────────────────────────
  const leverageLines: string[] = []
  const reasonLabel: Record<string, string> = {
    relocation: "relocating", financial_distress: "under financial pressure",
    divorce: "going through a divorce", bereavement: "dealing with a bereavement",
    downsizing: "downsizing", emigrating: "emigrating",
    chain_break: "a chain break", inheritance: "selling an inherited property",
    other: "moving on",
  }
  if (lead.reasonForSelling) leverageLines.push(reasonLabel[lead.reasonForSelling] ?? lead.reasonForSelling.replace(/_/g, " "))
  if (motivation !== null) leverageLines.push(`${motivation}/10 motivation`)
  if (lead.timelineDays) leverageLines.push(`${lead.timelineDays}-day deadline`)
  if (lead.urgencyLevel === "urgent") leverageLines.push("urgent sale")
  if (lead.competingOffers) leverageLines.push("⚠ competing offers — move fast")

  const leverageStr = leverageLines.length
    ? `Seller is ${leverageLines.join(", ")}.`
    : ""

  // ── Above market value ───────────────────────────────────────────────────────
  const aboveMarket = bmv !== null && bmv < 0
  const overBy = (aboveMarket && asking && marketVal) ? asking - marketVal : 0

  // ── Gross yield at asking ────────────────────────────────────────────────────
  const grossYieldAtAsking = asking && asking > 0 && annualRent
    ? (annualRent / asking) * 100
    : null

  // ── Discount needed from asking to reach each ceiling ───────────────────────
  const discountNeeded = (ceiling: number | null) =>
    ceiling && asking ? ((asking - ceiling) / asking * 100) : null

  // ── Verdict classification ───────────────────────────────────────────────────
  let verdict: SourcingVerdict
  if (passed && bmv !== null && bmv >= 25 && (motivation === null || motivation >= 7)) {
    verdict = "strong_buy"
  } else if (passed && bmv !== null && bmv >= 15) {
    verdict = "buy"
  } else if (!passed && hasViable && (motivation === null || motivation >= 5) && offer) {
    verdict = "negotiate"
  } else {
    verdict = "avoid"
  }

  // ── Build the narrative ──────────────────────────────────────────────────────
  let headline: string
  let body: string
  let action: string

  if (verdict === "strong_buy") {
    headline = "Strong buy — act now"
    const yieldLine = grossYieldAtAsking ? `${grossYieldAtAsking.toFixed(1)}% gross yield` : ""
    const stratLine = recommended
      ? `Best strategy: ${recommended}${brr?.viable ? " — full capital recycled after refinancing" : ""}.`
      : ""
    body = [
      `${bmv!.toFixed(1)}% below market value with ${profit ? gbp(profit) + " profit potential" : "solid upside"}.`,
      yieldLine ? `Rental income supports ${yieldLine} at asking price.` : "",
      stratLine,
      leverageStr,
    ].filter(Boolean).join(" ")
    action = `Open at ${offer ? gbp(Math.round((offer * 0.88) / 50) * 50) : "opening offer"} and secure with a lockout agreement immediately.`

  } else if (verdict === "buy") {
    headline = "Good deal — proceed"
    const yieldLine = btl?.viable && btl.yieldAtOffer ? `BTL yields ${btl.yieldAtOffer.toFixed(1)}% at the recommended offer — above the minimum threshold.` : ""
    const flipLine = flip?.viable && flip.flipProfit ? `Flip pencils at ${gbp(flip.flipProfit)} profit.` : ""
    body = [
      `${bmv!.toFixed(1)}% BMV gives ${profit ? gbp(profit) : "meaningful"} profit potential.`,
      yieldLine || flipLine,
      brr?.viable ? "BRRR possible — refinance would recycle most/all capital." : "",
      leverageStr,
    ].filter(Boolean).join(" ")
    action = `Open at ${offer ? gbp(Math.round((offer * 0.88) / 50) * 50) : "opening offer"}. Don't exceed ${offer ? gbp(offer) : "the ceiling"}.`

  } else if (verdict === "negotiate") {
    headline = "Steep discount required — negotiate hard"

    const aboveLines = aboveMarket
      ? `Seller is asking ${gbp(overBy)} above market value (${gbp(marketVal!)}), putting you in negative BMV territory from the start.`
      : `At ${bmv !== null ? bmv.toFixed(1) + "% BMV" : "current price"}, this doesn't meet the 20% minimum — you need a bigger discount.`

    const stratLines: string[] = []
    if (brr?.viable && brr.maxViable) {
      const disc = discountNeeded(brr.maxViable)
      stratLines.push(`BRRR viable below ${gbp(brr.maxViable)}${disc ? ` (${disc.toFixed(0)}% off asking)` : ""}${brr.brrLeftIn === 0 ? " — full capital recycled" : brr.brrLeftIn ? `, ${gbp(brr.brrLeftIn)} left in` : ""}.`)
    }
    if (flip?.viable && flip.maxViable) {
      const disc = discountNeeded(flip.maxViable)
      stratLines.push(`Flip viable below ${gbp(flip.maxViable)}${disc ? ` (${disc.toFixed(0)}% off asking)` : ""}${flip.flipProfit ? ` — ${gbp(flip.flipProfit)} profit` : ""}.`)
    }
    if (!brr?.viable && !flip?.viable && btl?.maxViable) {
      stratLines.push(`BTL requires price below ${gbp(btl.maxViable)} — likely unrealistic at current asking.`)
    }

    const rentWarning = grossYieldAtAsking && grossYieldAtAsking < 5
      ? `Gross yield is only ${grossYieldAtAsking.toFixed(1)}% at asking price — income strategies won't work without a heavy discount.`
      : ""

    body = [aboveLines, rentWarning, ...stratLines, leverageStr].filter(Boolean).join(" ")
    action = offer
      ? `Open at ${gbp(Math.round((offer * 0.88) / 50) * 50)}. Walk away if they won't go below ${gbp(offer)}.`
      : "Open very low and walk away if seller won't negotiate meaningfully."

  } else {
    headline = "Walk away — numbers don't stack"
    const reason = aboveMarket
      ? `Asking price is ${gbp(overBy)} above market value with no viable exit strategy at any realistic price.`
      : `Deal fails minimum BMV and profit thresholds with no viable strategy.`
    const yieldNote = grossYieldAtAsking && grossYieldAtAsking < 4
      ? `Gross yield of ${grossYieldAtAsking.toFixed(1)}% is too low for any income strategy.`
      : ""
    body = [reason, yieldNote, leverageStr || "Seller motivation is unclear — limited negotiating leverage."].filter(Boolean).join(" ")
    action = "Do not pursue unless seller dramatically reprices. Archive this lead."
  }

  return { verdict, headline, body, action }
}

function SourcerSummaryPanel({ summary }: { summary: SourcerSummary }) {
  const colours: Record<SourcingVerdict, { border: string; bg: string; badge: string; badgeText: string; icon: string }> = {
    strong_buy: { border: "border-green-500/40", bg: "bg-green-500/10", badge: "bg-green-500/20 border-green-500/30", badgeText: "text-green-300", icon: "✅" },
    buy:        { border: "border-green-400/30", bg: "bg-green-400/8",  badge: "bg-green-400/20 border-green-400/30", badgeText: "text-green-300", icon: "✓" },
    negotiate:  { border: "border-amber-500/40", bg: "bg-amber-500/10", badge: "bg-amber-500/20 border-amber-500/30", badgeText: "text-amber-300", icon: "⚠️" },
    avoid:      { border: "border-red-500/30",   bg: "bg-red-500/8",    badge: "bg-red-500/20 border-red-500/30",     badgeText: "text-red-300",   icon: "✕" },
  }
  const c = colours[summary.verdict]

  return (
    <div className={cn("rounded-xl border p-3 space-y-2", c.border, c.bg)}>
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{c.icon}</span>
        <p className={cn("text-[11px] font-bold uppercase tracking-wide", c.badgeText)}>
          {summary.headline}
        </p>
      </div>
      <p className="text-[11px] text-slate-300 leading-relaxed">{summary.body}</p>
      <div className={cn("rounded-lg border px-2.5 py-2", c.badge)}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Action</p>
        <p className={cn("text-[11px] font-semibold leading-snug", c.badgeText)}>{summary.action}</p>
      </div>
    </div>
  )
}

// ─── strategy block parser ───────────────────────────────────────────────────

interface StrategyRow {
  key: string
  viable: boolean
  maxViable: number | null
  recommendedOffer: number | null
  yieldAtOffer: number | null
  flipProfit: number | null
  flipRoi: number | null
  brrProceeds: number | null
  brrLeftIn: number | null
}
interface StrategyBlock { strategies: StrategyRow[]; recommended: string | null }

function parseStrategyBlock(notes: string | null): StrategyBlock | null {
  if (!notes) return null
  const m = notes.match(/\[STRATEGY_DATA\]([\s\S]*?)\[\/STRATEGY_DATA\]/i)
  if (!m) return null
  try {
    const j = JSON.parse(m[1].trim())
    return { strategies: j.strategies ?? [], recommended: j.recommended ?? null }
  } catch { return null }
}

// ─── scorecard row ────────────────────────────────────────────────────────────

type RowStatus = "pass" | "negotiate" | "fail" | "info" | "none"

function ScorecardRow({
  criterion, icon, status, summary, children, defaultOpen = false,
}: {
  criterion: string
  icon: React.ReactNode
  status: RowStatus
  summary: string
  children?: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg: Record<RowStatus, { dot: string; badge: string; expandBg: string; label: string }> = {
    pass:      { dot: "bg-green-500", badge: "bg-green-100 text-green-700 border-green-200", expandBg: "border-t border-green-100 bg-green-50/50",  label: "✓ Pass"      },
    negotiate: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200", expandBg: "border-t border-amber-100 bg-amber-50/50",  label: "⚠ Negotiate" },
    fail:      { dot: "bg-red-500",   badge: "bg-red-100 text-red-700 border-red-200",       expandBg: "border-t border-red-100 bg-red-50/50",      label: "✕ Fail"      },
    info:      { dot: "bg-blue-400",  badge: "bg-blue-100 text-blue-700 border-blue-200",    expandBg: "border-t border-blue-100 bg-blue-50/20",    label: "ℹ Info"      },
    none:      { dot: "bg-gray-300",  badge: "bg-gray-100 text-gray-500 border-gray-200",    expandBg: "border-t border-gray-100 bg-gray-50",       label: "Pending"     },
  }
  const c = cfg[status]
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => { if (children) setOpen(!open) }}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors",
          children ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
        )}
      >
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 mt-0.5", c.dot)} />
        <div className="flex items-center gap-2 w-44 shrink-0">
          <span className="text-gray-400 shrink-0">{icon}</span>
          <span className="text-sm font-semibold text-gray-800">{criterion}</span>
        </div>
        <span className="text-sm text-gray-500 flex-1 min-w-0 truncate">{summary}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold border", c.badge)}>
            {c.label}
          </span>
          {children && (
            open
              ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
      </button>
      {open && children && (
        <div className={cn("px-5 py-4", c.expandBg)}>{children}</div>
      )}
    </div>
  )
}

// ─── KPI mini card ────────────────────────────────────────────────────────────

function KpiMini({ label, value, highlight = false, status }: {
  label: string; value: string; highlight?: boolean; status?: RowStatus
}) {
  const valueColor = status
    ? status === "pass" ? "text-green-700" : status === "negotiate" ? "text-amber-700" : status === "fail" ? "text-red-700" : "text-gray-900"
    : highlight ? "text-blue-700" : "text-gray-900"
  return (
    <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5">
      <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">{label}</p>
      <p className={cn("text-sm font-bold", valueColor)}>{value}</p>
    </div>
  )
}

// ─── Compact strategy table ───────────────────────────────────────────────────

function StrategyScoreTable({ block }: { block: StrategyBlock }) {
  const LABELS: Record<string, string> = {
    BTL: "Buy-to-Let (BTL)", BuyHold: "Buy & Hold", Flip: "Flip", BRR: "BRRR",
  }
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Strategy</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">Max Price</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">At Rec. Offer</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-600">Viable</th>
          </tr>
        </thead>
        <tbody>
          {block.strategies.map((s, i) => {
            const isRec = s.key === block.recommended
            const atOffer = s.viable
              ? s.yieldAtOffer != null ? `${s.yieldAtOffer.toFixed(1)}% yield`
                : s.flipProfit != null ? `£${Math.round(s.flipProfit).toLocaleString()} profit`
                : s.brrLeftIn === 0 ? "£0 left in"
                : "✓"
              : "—"
            return (
              <tr key={s.key} className={cn("border-b border-gray-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-gray-50/40")}>
                <td className="px-3 py-2.5 font-medium text-gray-800">
                  {LABELS[s.key] ?? s.key}
                  {isRec && (
                    <span className="ml-2 rounded-full bg-purple-100 border border-purple-200 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">REC</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                  {s.maxViable != null ? `£${Math.round(s.maxViable).toLocaleString()}` : "—"}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-semibold", s.viable ? "text-green-700" : "text-gray-400")}>
                  {atOffer}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {s.viable
                    ? <span className="text-green-600 font-bold">✓</span>
                    : <span className="text-red-400">✕</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export function ValidationModal({
  lead,
  onClose,
  onCheck,
  onUpdate,
}: {
  lead: VendorLead
  onClose: () => void
  onCheck?: () => Promise<void>
  onUpdate?: () => void
}) {
  const [checking, setChecking] = useState(false)

  const askingPrice  = toNum(lead.askingPrice) ?? 0
  const marketValue  = toNum(lead.estimatedMarketValue) ?? 0
  const monthlyRent  = toNum(lead.estimatedMonthlyRent) ?? 0
  const refurb       = toNum(lead.estimatedRefurbCost) ?? 0
  const offer        = toNum(lead.offerAmount)
  const opening      = offer ? calcOpening(offer) : null

  const bmv          = toNum(lead.bmvScore) ?? (marketValue > 0 ? ((marketValue - askingPrice) / marketValue) * 100 : 0)
  const annualRent   = monthlyRent * 12
  const grossYield   = askingPrice > 0 && annualRent > 0 ? (annualRent / askingPrice) * 100 : 0

  const passed        = lead.validationPassed
  const isNegotiation = lead.validationNotes?.startsWith("⚠️ NEGOTIATION REQUIRED")
  const verdict: RowStatus = passed === true ? "pass" : isNegotiation ? "negotiate" : passed === false ? "fail" : "none"

  const strategyBlock  = parseStrategyBlock(lead.validationNotes)
  const sourcerSummary = buildSourcerSummary(lead)

  // ── Derived values ────────────────────────────────────────────────────────
  const BMV_TARGET         = 20
  const bmvGap             = Math.max(0, BMV_TARGET - bmv)
  const targetAsking       = marketValue > 0 ? Math.round(marketValue * (1 - BMV_TARGET / 100)) : null
  const additionalDiscount = targetAsking && askingPrice > targetAsking ? askingPrice - targetAsking : null

  // Quick cost estimate for scorecard summary chip (full detail in row 6)
  const sdltEstimate  = Math.round(askingPrice * 0.03)
  const totalFees     = sdltEstimate + 1800 + 600 + 400
  const cashPurchase  = askingPrice + totalFees
  const mortgageCashIn = Math.round(askingPrice * 0.25) + totalFees

  // Row statuses
  const mvStatus: RowStatus    = marketValue > 0 ? "pass" : "none"
  const bmvStatus: RowStatus   = verdict === "none" ? "none" : verdict
  const rentStatus: RowStatus  = grossYield >= 7 ? "pass" : grossYield >= 5 ? "negotiate" : grossYield > 0 ? "fail" : "none"
  const viableCount            = strategyBlock?.strategies.filter(s => s.viable).length ?? 0
  const stratStatus: RowStatus = !strategyBlock ? "none" : viableCount >= 3 ? "pass" : viableCount >= 1 ? "negotiate" : "fail"
  const photoScore             = toNum(lead.photoConditionScore)
  const photoStatus: RowStatus = photoScore != null ? (photoScore >= 7 ? "pass" : photoScore >= 4 ? "negotiate" : "fail") : "none"

  // ── Left panel ────────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col p-5">
      {/* Property */}
      <div className="mb-5">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? lead.vendorName}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">{lead.propertyPostcode ?? ""}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">{lead.bedrooms} bed</span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">{lead.propertyType}</span>
          )}
          {lead.tenureType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">{lead.tenureType}</span>
          )}
        </div>
      </div>

      {/* Verdict */}
      <div className="mb-5">
        {verdict === "pass" && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-green-400 leading-none">PASSED</p>
            <p className="mt-1 text-[10px] text-green-300">Deal meets investment criteria</p>
          </div>
        )}
        {verdict === "negotiate" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-amber-400 leading-none">NEGOTIATE</p>
            <p className="mt-1 text-[10px] text-amber-300">Viable with price negotiation</p>
          </div>
        )}
        {verdict === "fail" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-red-400 leading-none">FAILED</p>
            <p className="mt-1 text-[10px] text-red-300">Does not meet criteria</p>
          </div>
        )}
        {verdict === "none" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <Calculator className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-lg font-extrabold text-slate-400 leading-none">NOT RUN</p>
            <p className="mt-1 text-[10px] text-slate-500">Calculate BMV to validate</p>
          </div>
        )}
      </div>

      {/* Offer */}
      {offer && (
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Recommended Offer</p>
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

      {/* Action */}
      {sourcerSummary && (
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Action</p>
          <div className={cn(
            "rounded-xl border px-3 py-2.5",
            verdict === "pass"      ? "border-green-500/30 bg-green-500/10"  :
            verdict === "negotiate" ? "border-amber-500/30 bg-amber-500/10"  :
            verdict === "fail"      ? "border-red-500/30 bg-red-500/10"      : "border-white/10 bg-white/5"
          )}>
            <p className={cn(
              "text-[11px] font-semibold leading-snug",
              verdict === "pass"      ? "text-green-300"  :
              verdict === "negotiate" ? "text-amber-200"  :
              verdict === "fail"      ? "text-red-300"    : "text-slate-400"
            )}>{sourcerSummary.action}</p>
          </div>
        </div>
      )}

      <div className="h-px bg-white/10 mb-5" />

      {/* Photos */}
      <div className="mb-4">
        <LeftPanelPhotoThumbs
          leadId={lead.id}
          conditionScore={lead.photoConditionScore}
          conditionOverride={lead.photoConditionOverride}
          analysisStatus={lead.photoAnalysisStatus}
        />
      </div>

      {/* Pipeline stage */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  // ── Right panel (scorecard) ───────────────────────────────────────────────

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="5xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 shrink-0 bg-gray-50/60">
        <div>
          <p className="text-sm font-bold text-gray-900">Deal Scorecard</p>
          <p className="text-xs text-gray-400">
            {lead.bmvValidatedAt
              ? `Calculated ${new Date(lead.bmvValidatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
              : "No validation run yet"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {lead.validationNotes ? (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">

          {/* Column headers */}
          <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-200">
            <div className="w-2.5 shrink-0" />
            <div className="w-44 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Criterion</span>
            </div>
            <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Summary</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-6">Result</span>
          </div>

          {/* ── Row 1: Market Value ───────────────────────────────────── */}
          <ScorecardRow
            criterion="Market Value"
            icon={<Home className="h-3.5 w-3.5" />}
            status={mvStatus}
            summary={marketValue > 0 ? `${fmtCurrency(marketValue)} · from comparable sales` : "Not yet calculated"}
          >
            <div className="grid grid-cols-3 gap-3">
              <KpiMini label="Market Value" value={fmtCurrency(marketValue)} highlight />
              <KpiMini label="Asking Price" value={fmtCurrency(askingPrice)} />
              <KpiMini label="Equity at Asking" value={fmtCurrency(marketValue - askingPrice)} />
            </div>
          </ScorecardRow>

          {/* ── Row 2: BMV Discount ───────────────────────────────────── */}
          <ScorecardRow
            criterion="BMV Discount"
            icon={<TrendingDown className="h-3.5 w-3.5" />}
            status={bmvStatus}
            summary={
              bmv > 0
                ? bmvGap > 0
                  ? `${bmv.toFixed(1)}% — ${bmvGap.toFixed(1)}pp below ${BMV_TARGET}% target`
                  : `${bmv.toFixed(1)}% — above ${BMV_TARGET}% target ✓`
                : "Not calculated"
            }
            defaultOpen={bmvStatus !== "pass"}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <KpiMini label={`BMV Score (target ${BMV_TARGET}%)`} value={`${bmv.toFixed(1)}%`} status={bmvStatus} />
                <KpiMini label="Profit Potential" value={fmtCurrency(toNum(lead.profitPotential))} />
                <KpiMini label="Asking Price" value={fmtCurrency(askingPrice)} />
              </div>
              {bmvGap > 0 && targetAsking && additionalDiscount && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    To hit {BMV_TARGET}% BMV, asking price must be{" "}
                    <span className="font-extrabold">{fmtCurrency(targetAsking)}</span> or below
                  </p>
                  <p className="text-xs text-amber-700">
                    That's <span className="font-bold">{fmtCurrency(additionalDiscount)}</span> more discount needed
                    from the current asking price of {fmtCurrency(askingPrice)}.
                  </p>
                </div>
              )}
            </div>
          </ScorecardRow>

          {/* ── Row 3: Rental Income ─────────────────────────────────── */}
          <ScorecardRow
            criterion="Rental Income"
            icon={<Home className="h-3.5 w-3.5" />}
            status={rentStatus}
            summary={
              monthlyRent > 0
                ? `${fmtCurrency(monthlyRent)}/mo · ${grossYield.toFixed(2)}% gross yield`
                : "No rental data"
            }
          >
            <div className="grid grid-cols-4 gap-3">
              <KpiMini label="Monthly" value={fmtCurrency(monthlyRent)} highlight />
              <KpiMini label="Annual" value={fmtCurrency(annualRent)} />
              <KpiMini label="Weekly" value={`£${Math.round(monthlyRent / 4.333).toLocaleString()}`} />
              <KpiMini label="Gross Yield" value={`${grossYield.toFixed(2)}%`} status={rentStatus} />
            </div>
          </ScorecardRow>

          {/* ── Row 4: Strategy Fit ───────────────────────────────────── */}
          <ScorecardRow
            criterion="Strategy Fit"
            icon={<BarChart2 className="h-3.5 w-3.5" />}
            status={stratStatus}
            summary={
              strategyBlock
                ? `${viableCount} of ${strategyBlock.strategies.length} viable${strategyBlock.recommended ? ` · Recommended: ${strategyBlock.recommended}` : ""}`
                : "No strategy data"
            }
            defaultOpen
          >
            {strategyBlock && <StrategyScoreTable block={strategyBlock} />}
          </ScorecardRow>

          {/* ── Row 5: Photo Condition ────────────────────────────────── */}
          <ScorecardRow
            criterion="Photo Condition"
            icon={<Camera className="h-3.5 w-3.5" />}
            status={photoStatus}
            summary={photoScore != null ? `AI condition score: ${photoScore}/10` : "No analysis yet — upload photos"}
          >
            <PhotoConditionCard
              conditionScore={lead.photoConditionScore}
              conditionOverride={lead.photoConditionOverride}
              analysisStatus={lead.photoAnalysisStatus}
              photoCount={lead._count?.photos ?? 0}
            />
          </ScorecardRow>

          {/* ── Row 6: Acquisition & Costs ───────────────────────────── */}
          <ScorecardRow
            criterion="Acquisition & Costs"
            icon={<Calculator className="h-3.5 w-3.5" />}
            status="info"
            summary={
              askingPrice > 0
                ? `Cash: ${fmtCurrency(cashPurchase)} · With 75% mortgage: ${fmtCurrency(mortgageCashIn)}`
                : "Enter asking price to calculate"
            }
          >
            <AcquisitionCostPanel
              purchasePrice={askingPrice}
              refurbCost={refurb || undefined}
              monthlyRent={monthlyRent || 0}
              savedBuyerType={lead.sdltBuyerType ?? null}
              savedSolicitorFees={toNum(lead.solicitorFeesOverride) ?? null}
              savedSurveyFee={toNum(lead.surveyFeeOverride) ?? null}
              savedBridgingCost={toNum(lead.bridgingCostOverride) ?? null}
              savedInsurance={toNum(lead.insuranceOverride) ?? null}
              onSave={async (overrides) => {
                const body: Record<string, unknown> = {}
                if (overrides.buyerType !== undefined) body.sdltBuyerType = overrides.buyerType
                if (overrides.solicitorFees !== undefined) body.solicitorFeesOverride = overrides.solicitorFees
                if (overrides.surveyFee !== undefined) body.surveyFeeOverride = overrides.surveyFee
                if (overrides.bridgingCost !== undefined) body.bridgingCostOverride = overrides.bridgingCost
                if (overrides.insurance !== undefined) body.insuranceOverride = overrides.insurance
                await fetch(`/api/vendor-pipeline/leads/${lead.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                })
                onUpdate?.()
              }}
            />
          </ScorecardRow>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
          <div className="rounded-full bg-gray-100 p-5 mb-4">
            <Home className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">No Validation Run Yet</p>
          <p className="text-xs text-gray-400 mb-6 max-w-xs">
            Calculate BMV to analyse this deal and get a full scorecard breakdown
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
    </ModalShell>
  )
}
