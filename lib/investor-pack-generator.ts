/**
 * Investor Pack PDF Generator V4
 * Professional magazine-quality A4 PDF
 * – No empty pages: content flows naturally, page breaks only where meaningful
 * – Consistent 8pt grid design system
 * – Photo-forward layout with magazine-style grids
 * – Merged financial + cashflow into a single dense investment page
 */

import { prisma } from "@/lib/db"
import puppeteer from "puppeteer"
import { calculateStampDuty } from "./calculations/deal-metrics"
import { fetchRentalData } from "./propertydata"

// ─── Types ──────────────────────────────────────────────────────────────────

interface RentalMarket {
  monthlyRent: number
  weeklyRent: number
  confidenceRange: { min: number; max: number }
}

interface InvestorPackData {
  deal: any
  comparables: any[]
  richComparables: any[]   // ComparableProperty[] via VendorLead — richer than Comparable[]
  listing: any | null
  allPhotoUrls: string[]
  companyInfo: CompanyInfo
  rentalMarket: RentalMarket | null
}

interface CompanyInfo {
  name: string
  phone: string
  email: string
  website: string
}

interface Metrics {
  askingPrice: number
  marketValue: number
  refurbCost: number
  afterRefurbValue: number
  monthlyRent: number
  annualRent: number
  bmvPercentage: number
  profitPotential: number
  stampDuty: number
  legalFees: number
  totalInvestment: number
  grossYield: number
  netYield: number
  roi: number
  arvProfit: number | null
  voidAllowance: number
  maintenanceAllowance: number
  managementFee: number
  monthlyNetCashflow: number
  annualNetCashflow: number
  paybackYears: number | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=85",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=85",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=85",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=85",
]

// Font registry — maps designer IDs to CSS stack + optional Google Fonts URL
const FONT_CSS: Record<string, string> = {
  system:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  georgia:   "Georgia, 'Times New Roman', serif",
  inter:     "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  playfair:  "'Playfair Display', Georgia, serif",
  lato:      "'Lato', -apple-system, BlinkMacSystemFont, sans-serif",
}
const FONT_GOOGLE: Record<string, string | null> = {
  system:    null,
  helvetica: null,
  georgia:   null,
  inter:     "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  playfair:  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  lato:      "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap",
}

// Sample data used for template preview (no DB required)
const PREVIEW_DEAL: any = {
  id: "preview",
  address: "14 Whitmore Road, Birmingham B5 7LN",
  postcode: "B5 7LN",
  propertyType: "Terraced House",
  bedrooms: 3,
  bathrooms: 1,
  squareFeet: 1050,
  askingPrice: 145000,
  marketValue: 175000,
  estimatedMonthlyRent: 850,
  estimatedRefurbCost: 12000,
  afterRefurbValue: 185000,
  photos: [],
  comparables: [],
  propertyListings: [],
}
const PREVIEW_LISTING: any = {
  description: "A well-presented three-bedroom terraced property in a popular residential location close to local amenities and transport links. The property benefits from gas central heating, double-glazed windows, a modern fitted kitchen and a private rear garden — an ideal buy-to-let investment.",
  keyFeatures: [
    "Three well-proportioned bedrooms",
    "Modern fitted kitchen with integrated appliances",
    "Gas central heating throughout",
    "Double glazing",
    "Private rear garden",
    "Close to schools and amenities",
    "Strong rental demand area",
    "EPC rated D — upgrade potential",
  ],
  squareFeet: 1050,
  daysOnMarket: 28,
  epcRating: "D",
  isChainFree: true,
  tenure: "FREEHOLD",
  images: PLACEHOLDER_IMAGES,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat("en-GB").format(Math.round(n))
const gbp = (n: number) => `\u00a3${fmt(n)}`
const pct = (n: number, dp = 1) => `${n.toFixed(dp)}%`

function calculateMetrics(deal: any): Metrics {
  const askingPrice      = Number(deal.askingPrice) || 0
  const marketValue      = Number(deal.marketValue) || Number(deal.estimatedMarketValue) || 0
  const refurbCost       = Number(deal.estimatedRefurbCost) || 0
  const afterRefurbValue = Number(deal.afterRefurbValue) || 0
  const monthlyRent      = Number(deal.estimatedMonthlyRent) || 0
  const annualRent       = monthlyRent * 12

  const bmvPercentage   = marketValue > 0 ? ((marketValue - askingPrice) / marketValue) * 100 : 0
  const profitPotential = marketValue > 0 ? marketValue - askingPrice : 0
  const stampDuty       = calculateStampDuty(askingPrice)
  const legalFees       = 1500
  const totalInvestment = askingPrice + refurbCost + stampDuty + legalFees

  const grossYield = askingPrice > 0 ? (annualRent / askingPrice) * 100 : 0
  const netYield   = grossYield * 0.85
  const roi        = totalInvestment > 0 ? (profitPotential / totalInvestment) * 100 : 0
  const arvProfit  = afterRefurbValue > 0 ? afterRefurbValue - totalInvestment : null

  const voidAllowance        = monthlyRent * 0.05
  const maintenanceAllowance = monthlyRent * 0.05
  const managementFee        = monthlyRent * 0.10
  const monthlyNetCashflow   = monthlyRent - voidAllowance - maintenanceAllowance - managementFee
  const annualNetCashflow    = monthlyNetCashflow * 12
  const paybackYears         = annualNetCashflow > 0 ? totalInvestment / annualNetCashflow : null

  return {
    askingPrice, marketValue, refurbCost, afterRefurbValue, monthlyRent, annualRent,
    bmvPercentage, profitPotential, stampDuty, legalFees, totalInvestment,
    grossYield, netYield, roi, arvProfit,
    voidAllowance, maintenanceAllowance, managementFee,
    monthlyNetCashflow, annualNetCashflow, paybackYears,
  }
}

// ─── Template meta helpers ────────────────────────────────────────────────────

/** Extract _meta entry from template.sections — holds font, header/footer config */
function extractMeta(template?: any): Record<string, any> {
  if (!template?.sections || !Array.isArray(template.sections)) return {}
  return (template.sections as any[]).find((s: any) => s.type === "_meta") ?? {}
}

/** Inject a thin page header strip at the top of each non-cover page */
function injectPageHeader(html: string, meta: Record<string, any>): string {
  const left  = (meta.pageHeaderLeft  || "").trim()
  const right = (meta.pageHeaderRight || "").trim()
  if (!left && !right) return html
  const headerHtml = `<div class="page-header"><span>${left}</span><span>${right}</span></div>`
  return html.replace('<div class="section-head">', `${headerHtml}\n  <div class="section-head">`)
}

/** Build a page footer string from meta config */
function buildPageFooterContent(
  meta: Record<string, any>,
  defaults: { left: string; right: string }
): { left: string; right: string } {
  const left  = (meta.pageFooterLeft  || "").trim() || defaults.left
  const right = (meta.pageFooterRight || "").trim() || defaults.right
  return { left, right }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateInvestorPack(dealId: string, template?: any): Promise<Buffer> {
  const data = await fetchDealData(dealId)
  const html = generateHTML(data, template)
  return htmlToPDF(html)
}

/** Generate a preview HTML string using sample deal data — no DB required */
export function generatePreviewHTML(template?: any): string {
  const previewCompanyInfo: CompanyInfo = {
    name:    "Your Company Name",
    phone:   "+44 20 7123 4567",
    email:   "deals@yourcompany.co.uk",
    website: "www.yourcompany.co.uk",
  }
  const data: InvestorPackData = {
    deal:           PREVIEW_DEAL,
    comparables:    [],
    richComparables: [],
    listing:        PREVIEW_LISTING,
    allPhotoUrls:   PREVIEW_LISTING.images,
    companyInfo:    previewCompanyInfo,
    rentalMarket:   {
      monthlyRent:      850,
      weeklyRent:       196,
      confidenceRange:  { min: 775, max: 925 },
    },
  }
  return generateHTML(data, template)
}

// ─── Data fetching ───────────────────────────────────────────────────────────

async function fetchDealData(dealId: string): Promise<InvestorPackData> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      photos:           { orderBy: { sortOrder: "asc" } },
      comparables:      { orderBy: { saleDate: "desc" }, take: 10 },
      propertyListings: { orderBy: { scrapedAt: "desc" }, take: 1 },
      assignedTo:       { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
  })
  if (!deal) throw new Error(`Deal ${dealId} not found`)

  const companyProfile = await prisma.companyProfile.findFirst()
  const companyInfo: CompanyInfo = {
    name:    companyProfile?.companyName    || "DealStack",
    phone:   companyProfile?.companyPhone   || "+44 20 1234 5678",
    email:   companyProfile?.companyEmail   || "deals@dealstack.co.uk",
    website: companyProfile?.companyWebsite || "www.dealstack.co.uk",
  }

  const s3Urls      = (deal.photos || []).map((p: any) => p.s3Url).filter(Boolean)
  const listing     = deal.propertyListings?.[0] ?? null
  const rawImages   = listing?.images
  const scraperImgs: string[] = Array.isArray(rawImages)
    ? (rawImages as any[]).filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http")).slice(0, 14)
    : []

  const combined     = [...s3Urls, ...scraperImgs.filter(u => !s3Urls.includes(u))]
  const allPhotoUrls = combined.length > 0 ? combined : PLACEHOLDER_IMAGES

  // Fetch live rental market data for the area (low cost, no photo needed)
  let rentalMarket: RentalMarket | null = null
  if (deal.postcode) {
    try {
      rentalMarket = await fetchRentalData(
        deal.postcode,
        deal.bedrooms ?? undefined,
        deal.propertyType ?? undefined
      )
    } catch { /* non-fatal */ }
  }

  // Fetch rich ComparableProperty records via the linked VendorLead (if any)
  // VendorLead.dealId is a plain string FK stored on the vendor_leads table
  let richComparables: any[] = []
  try {
    const vendorLead = await prisma.vendorLead.findFirst({
      where: { dealId: dealId },
      include: {
        comparableProperties: {
          orderBy: { saleDate: "desc" },
          take: 12,
        },
      },
    })
    if (vendorLead?.comparableProperties?.length) {
      richComparables = vendorLead.comparableProperties
    }
  } catch { /* non-fatal — fall back to sparse comparables */ }

  return { deal, comparables: deal.comparables || [], richComparables, listing, allPhotoUrls, companyInfo, rentalMarket }
}

// ─── HTML orchestration ──────────────────────────────────────────────────────

function defaultSections() {
  return [
    { type: "cover",       enabled: true, order: 0 },
    { type: "property",    enabled: true, order: 1 },
    { type: "investment",  enabled: true, order: 2 },
    { type: "comparables", enabled: true, order: 3 },
    { type: "cta",         enabled: true, order: 4 },
  ]
}

function resolveSections(template?: any) {
  if (!template) return defaultSections()

  if (template.templateType === "4-part") {
    const parts = ["part1Sections","part2Sections","part3Sections","part4Sections"]
    const enabled = parts.filter((_,i) => template[`part${i+1}Enabled`])
    const all = enabled.flatMap(k => (Array.isArray(template[k]) ? template[k] : []).filter((s: any) => s.enabled))
    return all.length > 0 ? all.sort((a: any, b: any) => a.order - b.order) : defaultSections()
  }

  if (template.sections) {
    const s = (Array.isArray(template.sections) ? template.sections : [])
      .filter((s: any) => s.enabled)
      .sort((a: any, b: any) => a.order - b.order)
    return s.length > 0 ? s : defaultSections()
  }

  return defaultSections()
}

// Normalise legacy section types to new keys
function normaliseType(t: string): string {
  if (["deal_cover",    "cover"                     ].includes(t)) return "cover"
  if (["deal_property", "deal_overview", "property" ].includes(t)) return "property"
  if (["deal_metrics",  "metrics"                   ].includes(t)) return "metrics"    // merged → investment
  if (["deal_financial","financial"                  ].includes(t)) return "financial"  // merged → investment
  if (["deal_returns",  "returns"                    ].includes(t)) return "returns"    // merged → investment
  if (["deal_market",   "comparables"                ].includes(t)) return "comparables"
  if (["deal_cta",      "cta"                        ].includes(t)) return "cta"
  if (t === "investment"                                           ) return "investment"
  return t
}

function generateHTML(data: InvestorPackData, template?: any): string {
  const { deal, comparables, richComparables, listing, allPhotoUrls, companyInfo, rentalMarket } = data
  const metrics  = calculateMetrics(deal)
  const sections = resolveSections(template)

  // Deduplicate: if both "financial" and "returns" are present, render them as one "investment" block
  const seen     = new Set<string>()
  const rendered: string[] = []

  for (const section of sections) {
    const type = normaliseType(section.type ?? "")

    // Merge financial/returns/metrics into a single investment page
    const investmentKey = ["metrics", "financial", "returns"].includes(type) ? "investment" : type

    if (seen.has(investmentKey)) continue
    seen.add(investmentKey)

    // Extract per-section config stored in the template's sections JSON array
    const rawSections: any[] = Array.isArray(template?.sections) ? template.sections : []
    const sectionCfg: Record<string, any> = (rawSections.find((s: any) => s.type === investmentKey))?.config ?? {}

    let html = ""
    if (investmentKey === "cover")            html = sectionCover(deal, metrics, allPhotoUrls[0], companyInfo, template, sectionCfg)
    else if (investmentKey === "property")    html = sectionProperty(deal, metrics, listing, allPhotoUrls, sectionCfg)
    else if (investmentKey === "investment")  html = sectionInvestment(deal, metrics, sectionCfg)
    else if (investmentKey === "comparables") html = sectionComparables(deal, comparables, richComparables, metrics, rentalMarket, sectionCfg)
    else if (investmentKey === "cta")         html = sectionCTA(deal, metrics, companyInfo, sectionCfg)

    if (html) rendered.push(html)
  }

  // Apply page header to non-cover pages
  const meta      = extractMeta(template)
  const fontId    = meta.fontFamily ?? "system"
  const googleUrl = FONT_GOOGLE[fontId] ?? null

  const finalRendered = rendered.map((html, i) =>
    i === 0 ? html : injectPageHeader(html, meta)
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${googleUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleUrl}" rel="stylesheet">` : ""}
  <style>${buildCSS(template, fontId)}</style>
</head>
<body>
${finalRendered.join("\n")}
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: COVER  (Page 1 — full bleed, always exactly one page)
// ─────────────────────────────────────────────────────────────────────────────
function sectionCover(deal: any, m: Metrics, photoUrl: string, company: CompanyInfo, template?: any, cfg: Record<string,any> = {}): string {
  const eyebrow    = cfg.eyebrow     || "Confidential Investment Memorandum"
  const showKpis   = cfg.showKpis    !== false
  const showSubt   = cfg.showSubtitle !== false

  const date     = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const subtitle = [
    deal.propertyType,
    deal.bedrooms   ? `${deal.bedrooms} Bedroom${deal.bedrooms > 1 ? "s" : ""}` : null,
    deal.bathrooms  ? `${deal.bathrooms} Bathroom${deal.bathrooms > 1 ? "s" : ""}` : null,
    deal.postcode,
  ].filter(Boolean).join("  ·  ")

  const kpis = [
    { label: "Purchase Price",   value: gbp(m.askingPrice),         cls: "kpi-white"  },
    { label: "Below Market Value", value: pct(m.bmvPercentage),   cls: "kpi-green"  },
    { label: "Instant Equity",   value: gbp(m.profitPotential),     cls: "kpi-gold"   },
    ...(m.grossYield > 0 ? [{ label: "Gross Yield", value: pct(m.grossYield, 2), cls: "kpi-blue" }] : []),
  ]

  const tagLine = cfg.tagLine || "Exclusive Investment Opportunity"

  return `<div class="page cover-page">
  <img src="${photoUrl}" class="cover-photo" alt="Property" />
  <div class="cover-overlay"></div>
  <div class="cover-body">

    <!-- Top bar -->
    <div class="cover-top">
      <div class="cover-brand">${company.name}</div>
      <div class="cover-tag">${tagLine}</div>
    </div>

    <!-- Main headline -->
    <div class="cover-headline">
      <div class="cover-eyebrow">${eyebrow}</div>
      <h1 class="cover-address">${deal.address}</h1>
      ${showSubt && subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
    </div>

    ${showKpis ? `<!-- KPI strip -->
    <div class="cover-kpis">
      ${kpis.map(k => `
      <div class="cover-kpi ${k.cls}">
        <div class="cover-kpi-value">${k.value}</div>
        <div class="cover-kpi-label">${k.label}</div>
      </div>`).join("")}
    </div>` : ""}

    <!-- Footer -->
    <div class="cover-footer">
      <span>${company.phone}  ·  ${company.email}  ·  ${company.website}</span>
      <span>Generated ${date}</span>
    </div>
  </div>
</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: PROPERTY  (Page 2 — photos, specs, features, description)
// ─────────────────────────────────────────────────────────────────────────────
function sectionProperty(deal: any, m: Metrics, listing: any, photos: string[], cfg: Record<string,any> = {}): string {
  const showDesc     = cfg.showDescription !== false
  const showFeatures = cfg.showFeatures    !== false
  const photoLayout  = cfg.photoLayout ?? "hero+grid"

  const heroOnly  = photoLayout === "hero"
  const useStrip  = photoLayout === "hero+strip"

  const hero   = photos[0]
  const grid   = heroOnly ? [] : useStrip ? [] : photos.slice(1, 4)
  const strip  = useStrip ? photos.slice(1, 5) : []
  const extra  = heroOnly || useStrip ? [] : photos.slice(4, 8)

  const features: string[] = Array.isArray(listing?.keyFeatures) ? listing.keyFeatures.slice(0, 12) : []
  const desc: string       = listing?.description ? String(listing.description).slice(0, 600) : ""
  const epc                = listing?.epcRating ?? null
  const chainFree          = listing?.isChainFree ?? null
  const tenure             = listing?.tenure ?? null
  const dom                = listing?.daysOnMarket ?? null
  const sqft               = deal.squareFeet ?? listing?.squareFeet ?? null

  const specChips = [
    deal.propertyType,
    deal.bedrooms   ? `${deal.bedrooms} Bed` : null,
    deal.bathrooms  ? `${deal.bathrooms} Bath` : null,
    sqft            ? `${fmt(sqft)} sq ft` : null,
    deal.postcode,
    tenure          ? (tenure === "LEASEHOLD" ? "Leasehold" : "Freehold") : null,
    epc             ? `EPC ${epc}` : null,
    chainFree === true ? "Chain Free" : null,
    dom !== null    ? `${dom} days listed` : null,
  ].filter(Boolean)

  // Decide fallback features if no listing data
  const featureItems = features.length > 0 ? features : [
    `${pct(m.bmvPercentage)} below market value — instant equity from day one`,
    `${gbp(m.profitPotential)} profit potential built in at acquisition`,
    ...(m.grossYield > 0 ? [`${pct(m.grossYield, 2)} gross yield — strong rental income potential`] : []),
    "Thoroughly sourced and independently assessed deal",
  ]

  const secTitle = cfg.sectionTitle    || "The Property"
  const secSub   = cfg.sectionSubtitle || "Photography, specifications &amp; listing highlights"

  return `<div class="page content-page break-before">
  <div class="section-head">
    <div class="section-label">02</div>
    <div>
      <div class="section-title">${secTitle}</div>
      <div class="section-sub">${secSub}</div>
    </div>
  </div>

  <!-- Hero photo -->
  <div class="photo-hero-wrap">
    <img src="${hero}" class="photo-hero" alt="Property" />
  </div>

  <!-- Secondary photo grid -->
  ${grid.length > 0 ? `<div class="photo-grid photo-grid-${Math.min(grid.length, 3)}">
    ${grid.map((u, i) => `<img src="${u}" class="photo-grid-img" alt="Property view ${i+2}" />`).join("")}
  </div>` : ""}

  <!-- Hero+strip layout -->
  ${strip.length > 0 ? `<div class="photo-strip">
    ${strip.map((u, i) => `<img src="${u}" class="photo-strip-img" alt="Property interior ${i+1}" />`).join("")}
  </div>` : ""}

  <!-- Extra strip (hero+grid only) -->
  ${extra.length > 0 ? `<div class="photo-strip">
    ${extra.map((u, i) => `<img src="${u}" class="photo-strip-img" alt="Property interior ${i+1}" />`).join("")}
  </div>` : ""}

  <!-- Spec chips -->
  <div class="spec-chips">
    ${specChips.map(s => `<span class="spec-chip">${s}</span>`).join("")}
  </div>

  <!-- Features + Description two-column -->
  ${(showFeatures || showDesc) ? `<div class="property-details-grid">
    ${showFeatures ? `<div>
      <div class="sub-heading">Property Highlights</div>
      <ul class="features-list">
        ${featureItems.map(f => `<li class="feature-item"><span class="feature-tick">✓</span><span>${f}</span></li>`).join("")}
      </ul>
    </div>` : ""}
    ${showDesc && desc ? `<div>
      <div class="sub-heading">Listing Description</div>
      <p class="listing-desc">${desc}${(listing?.description?.length ?? 0) > 600 ? "…" : ""}</p>
    </div>` : ""}
  </div>` : ""}

  <div class="page-footer">
    <span>${deal.address}</span>
    <span>Property Overview  ·  Page 2</span>
  </div>
</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: INVESTMENT  (Page 3 — metrics grid + cost table + cashflow)
// ─────────────────────────────────────────────────────────────────────────────
function sectionInvestment(deal: any, m: Metrics, cfg: Record<string,any> = {}): string {
  const showHeroMetrics   = cfg.showHeroMetrics    !== false
  const showCostBreakdown = cfg.showCostBreakdown  !== false
  const showCashflow      = cfg.showCashflow       !== false
  const showScenarios     = cfg.showScenarios      !== false
  const showARV           = cfg.showARV            !== false

  const hasRent  = m.monthlyRent > 0
  const hasARV   = showARV && m.afterRefurbValue > 0 && m.arvProfit !== null
  const investPct = m.marketValue > 0
    ? Math.min((m.totalInvestment / m.marketValue) * 100, 100)
    : 0

  // Yield scenarios
  const scenarios = [
    { label: "Conservative", factor: 0.90 },
    { label: "Base Case",    factor: 1.00 },
    { label: "Optimistic",   factor: 1.10 },
  ]

  const secTitle = cfg.sectionTitle    || "Investment Analysis"
  const secSub   = cfg.sectionSubtitle || "Financial metrics, cost breakdown &amp; return projections"

  return `<div class="page content-page break-before">
  <div class="section-head">
    <div class="section-label">03</div>
    <div>
      <div class="section-title">${secTitle}</div>
      <div class="section-sub">${secSub}</div>
    </div>
  </div>

  <!-- Hero metric strip — 4 large coloured cards -->
  ${showHeroMetrics ? `<div class="metrics-hero-strip">
    <div class="mh-cell mh-dark">
      <div class="mh-label">Purchase Price</div>
      <div class="mh-value">${gbp(m.askingPrice)}</div>
      <div class="mh-note">Acquisition cost</div>
    </div>
    <div class="mh-cell mh-dark mh-border">
      <div class="mh-label">Market Value</div>
      <div class="mh-value">${gbp(m.marketValue)}</div>
      <div class="mh-note">Independent assessment</div>
    </div>
    <div class="mh-cell mh-green">
      <div class="mh-label">BMV Discount</div>
      <div class="mh-value">${pct(m.bmvPercentage)}</div>
      <div class="mh-note">${gbp(m.profitPotential)} saving</div>
    </div>
    <div class="mh-cell mh-gold">
      <div class="mh-label">Instant Equity</div>
      <div class="mh-value">${gbp(m.profitPotential)}</div>
      <div class="mh-note">Built in at purchase</div>
    </div>
  </div>

  <!-- Secondary metric row -->
  <div class="metrics-secondary-strip">
    ${hasRent ? `
    <div class="ms-cell ms-blue">
      <div class="ms-icon">&#8353;</div>
      <div class="ms-label">Monthly Rent</div>
      <div class="ms-value">${gbp(m.monthlyRent)}</div>
      <div class="ms-note">${gbp(m.annualRent)} per year</div>
    </div>
    <div class="ms-cell ms-blue">
      <div class="ms-icon">%</div>
      <div class="ms-label">Gross Yield</div>
      <div class="ms-value">${pct(m.grossYield, 2)}</div>
      <div class="ms-note">Net ${pct(m.netYield, 2)} after costs</div>
    </div>` : ""}
    <div class="ms-cell ms-amber">
      <div class="ms-icon">\u03a3</div>
      <div class="ms-label">Total Capital</div>
      <div class="ms-value">${gbp(m.totalInvestment)}</div>
      <div class="ms-note">All-in inc. fees &amp; SDLT</div>
    </div>
    <div class="ms-cell ms-amber">
      <div class="ms-icon">&#8593;</div>
      <div class="ms-label">ROI</div>
      <div class="ms-value">${pct(m.roi, 1)}</div>
      <div class="ms-note">On total capital deployed</div>
    </div>
  </div>` : ""}

  <!-- Two-column: cost table | cashflow waterfall -->
  <div class="analysis-cols">

    <!-- Cost breakdown -->
    <div class="analysis-col">
      ${showCostBreakdown ? `<div class="sub-heading">Full Cost Breakdown</div>` : ""}
      ${showCostBreakdown ? `<table class="cost-table">
        <tbody>
          <tr><td>Purchase Price</td><td class="td-right fw-bold">${gbp(m.askingPrice)}</td></tr>
          <tr><td>Stamp Duty (SDLT)</td><td class="td-right">${gbp(m.stampDuty)}</td></tr>
          <tr><td>Legal / Conveyancing</td><td class="td-right">${gbp(m.legalFees)}</td></tr>
          ${m.refurbCost > 0 ? `<tr><td>Refurbishment Budget</td><td class="td-right">${gbp(m.refurbCost)}</td></tr>` : ""}
          <tr class="cost-total"><td>Total Capital Required</td><td class="td-right">${gbp(m.totalInvestment)}</td></tr>
        </tbody>
      </table>

      <!-- Value bar -->
      <div class="value-bar-wrap">
        <div class="value-bar-labels">
          <span>Your Investment</span>
          <span>Market Value</span>
        </div>
        <div class="value-bar-track">
          <div class="value-bar-fill" style="width:${investPct.toFixed(0)}%">
            <span class="value-bar-pct">${investPct.toFixed(0)}%</span>
          </div>
        </div>
        <div class="equity-callout">
          <span class="equity-label">Instant equity:</span>
          <span class="equity-num">${gbp(m.profitPotential)}</span>
          <span class="equity-note">(${pct(m.bmvPercentage)} of market value)</span>
        </div>
      </div>` : ""}

      ${hasARV ? `
      <div class="sub-heading" style="margin-top:16px;">After-Refurb Value (ARV)</div>
      <div class="arv-grid">
        <div class="arv-cell"><div class="arv-label">All-In Cost</div><div class="arv-value">${gbp(m.totalInvestment)}</div></div>
        <div class="arv-cell arv-cell-mid"><div class="arv-label">ARV</div><div class="arv-value arv-blue">${gbp(m.afterRefurbValue)}</div></div>
        <div class="arv-cell arv-cell-last"><div class="arv-label">ARV Profit</div><div class="arv-value arv-green">${gbp(m.arvProfit ?? 0)}</div></div>
      </div>` : ""}
    </div>

    <!-- Cashflow / ROI -->
    <div class="analysis-col">
      ${hasRent && showCashflow ? `
      <div class="sub-heading">Monthly Cashflow Model</div>
      <div class="cashflow-hero">
        <div class="cf-hero-left">
          <div class="cf-hero-label">Net Monthly</div>
          <div class="cf-hero-value">${gbp(m.monthlyNetCashflow)}</div>
          <div class="cf-hero-sub">${gbp(m.annualNetCashflow)} per year</div>
        </div>
        <div class="cf-hero-right">
          <div class="cf-hero-label">Gross Monthly</div>
          <div class="cf-hero-value cf-gross">${gbp(m.monthlyRent)}</div>
          <div class="cf-hero-sub">${gbp(m.annualRent)} per year</div>
        </div>
      </div>

      <div class="waterfall">
        <div class="wf-row wf-income">
          <span class="wf-label">+ Rental Income</span>
          <span class="wf-amount wf-pos">+${gbp(m.monthlyRent)}</span>
        </div>
        <div class="wf-row wf-cost">
          <span class="wf-label">− Void Allowance (5%)</span>
          <span class="wf-amount wf-neg">−${gbp(m.voidAllowance)}</span>
        </div>
        <div class="wf-row wf-cost">
          <span class="wf-label">− Maintenance (5%)</span>
          <span class="wf-amount wf-neg">−${gbp(m.maintenanceAllowance)}</span>
        </div>
        <div class="wf-row wf-cost">
          <span class="wf-label">− Letting Agent (10%)</span>
          <span class="wf-amount wf-neg">−${gbp(m.managementFee)}</span>
        </div>
        <div class="wf-row wf-net">
          <span>Net Monthly Cashflow</span>
          <span>${gbp(m.monthlyNetCashflow)}</span>
        </div>
      </div>

      ${m.paybackYears !== null ? `
      <div class="payback-note">
        Investment payback via net cashflow: <strong>${m.paybackYears.toFixed(1)} years</strong>
      </div>` : ""}

      ${showScenarios ? `<div class="sub-heading" style="margin-top:16px;">Yield Scenarios</div>
      <table class="scenario-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th class="td-right">Monthly Rent</th>
            <th class="td-right">Gross Yield</th>
            <th class="td-right">Net Yield</th>
          </tr>
        </thead>
        <tbody>
          ${scenarios.map(s => {
            const r = m.monthlyRent * s.factor
            const g = m.askingPrice > 0 ? (r * 12 / m.askingPrice) * 100 : 0
            const n = g * 0.85
            return `<tr class="${s.label === "Base Case" ? "sc-base" : ""}">
              <td>${s.label}</td>
              <td class="td-right">${gbp(r)}</td>
              <td class="td-right">${pct(g, 2)}</td>
              <td class="td-right">${pct(n, 2)}</td>
            </tr>`
          }).join("")}
        </tbody>
      </table>` : ""}
      ` : `
      <!-- No rent data: show ROI summary instead -->
      <div class="sub-heading">Return on Investment</div>
      <div class="roi-block">
        <div class="roi-big">${pct(m.roi, 1)}</div>
        <div class="roi-sub">ROI on total capital of ${gbp(m.totalInvestment)}</div>
        <div class="roi-desc">Based on ${gbp(m.profitPotential)} profit potential vs. ${gbp(m.totalInvestment)} deployed</div>
      </div>
      `}
    </div>

  </div>

  <div class="page-footer">
    <span>${deal.address}</span>
    <span>Investment Analysis  ·  Page 3</span>
  </div>
</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: COMPARABLES  (Page 4 — Market Evidence with deep portal links)
// ─────────────────────────────────────────────────────────────────────────────
function sectionComparables(deal: any, comparables: any[], richComparables: any[], m: Metrics, rentalMarket: RentalMarket | null, cfg: Record<string,any> = {}): string {
  const showPortalLinks     = cfg.showPortalLinks      !== false
  const showYieldColumn     = cfg.showYieldColumn      !== false
  const showDaysOnMarket    = cfg.showDaysOnMarket     !== false
  const showConfidenceBadges = cfg.showConfidenceBadges !== false
  const showAdvantageBox    = cfg.showAdvantageBox     !== false

  // Prefer rich ComparableProperty records (vendor pipeline data); fall back to sparse Deal comparables
  const useRich  = richComparables.length > 0
  const valid    = useRich
    ? richComparables.filter(c => Number(c.salePrice || 0) > 0)
    : comparables.filter(c => Number(c.salePrice || c.price || 0) > 0)

  const avgPrice = valid.length > 0
    ? valid.reduce((s: number, c: any) => s + Number(c.salePrice || c.price || 0), 0) / valid.length
    : 0
  const saving    = avgPrice > 0 ? avgPrice - m.askingPrice : 0
  const savingPct = avgPrice > 0 ? (saving / avgPrice) * 100 : 0
  const pricePct  = avgPrice > 0 ? Math.min((m.askingPrice / avgPrice) * 100, 100) : 0
  const maxPrice  = valid.length > 0 ? Math.max(...valid.map((c: any) => Number(c.salePrice || c.price || 0))) : 0

  // Avg rental yield from rich comparables (if available)
  const yieldComps = useRich ? valid.filter((c: any) => Number(c.rentalYield || 0) > 0) : []
  const avgYield   = yieldComps.length > 0
    ? yieldComps.reduce((s: number, c: any) => s + Number(c.rentalYield), 0) / yieldComps.length : null

  // Avg monthly rent from rich comparables
  const rentComps  = useRich ? valid.filter((c: any) => Number(c.monthlyRent || 0) > 0) : []
  const avgCompRent = rentComps.length > 0
    ? rentComps.reduce((s: number, c: any) => s + Number(c.monthlyRent), 0) / rentComps.length : null

  // Build area portal deep links from postcode
  const postcode  = (deal.postcode || "").trim()
  const outcode   = postcode.split(" ")[0].toLowerCase()
  const pcEncoded = encodeURIComponent(postcode)
  const beds      = deal.bedrooms ?? ""
  const rmSoldUrl = `https://www.rightmove.co.uk/house-prices/${outcode}.html`
  const rmSaleUrl = `https://www.rightmove.co.uk/property-for-sale/find.html?searchType=SALE&searchLocation=${pcEncoded}&useLocationIdentifier=true${beds ? `&minBedrooms=${beds}&maxBedrooms=${beds}` : ""}`
  const zooplaUrl = `https://www.zoopla.co.uk/house-prices/property/${outcode}/`
  const govUrl    = `https://landregistry.data.gov.uk/app/ppd?et%5B%5D=lrcommon%3Afreehold&et%5B%5D=lrcommon%3Aleasehold&postcode=${pcEncoded}&tc%5B%5D=lrcommon%3Astandard`

  // Rental market derived yield (PropertyData API)
  const areaYield = rentalMarket && m.askingPrice > 0
    ? ((rentalMarket.monthlyRent * 12) / m.askingPrice) * 100 : null

  const displayYield  = avgYield ?? areaYield
  const displayRent   = avgCompRent ?? (rentalMarket ? rentalMarket.monthlyRent : null)
  const noComps       = valid.length === 0
  const dataSource    = useRich
    ? "PropertyData / Rightmove / Zoopla (via Vendor Pipeline)"
    : "HM Land Registry / PropertyData API"

  // Per-property confidence helper
  const confInfo = (c: any) => {
    const score = useRich ? Number(c.confidence ?? 1) : 1
    if (score >= 0.8) return { label: "HIGH",   cls: "cb-high" }
    if (score >= 0.5) return { label: "MED",    cls: "cb-med"  }
    return              { label: "LOW",    cls: "cb-low"  }
  }

  const secTitle = cfg.sectionTitle    || "Market Evidence"
  const secSub   = cfg.sectionSubtitle || `${useRich ? "Rich comparable data · Rightmove &amp; Zoopla links included · " : ""}${valid.length} transactions analysed`

  return `<div class="page content-page break-before">
  <div class="section-head">
    <div class="section-label">04</div>
    <div>
      <div class="section-title">${secTitle}</div>
      <div class="section-sub">${secSub}</div>
    </div>
    ${useRich ? `<div class="rich-data-badge">&#10003; Rich Data</div>` : ""}
  </div>

  <!-- Market intelligence panel (4-col) -->
  <div class="market-intel-grid">
    <div class="mi-card mi-card-primary">
      <div class="mi-label">Subject Purchase Price</div>
      <div class="mi-value">${gbp(m.askingPrice)}</div>
      <div class="mi-sub">vs. market value ${gbp(m.marketValue)}</div>
    </div>
    <div class="mi-card ${avgPrice > 0 ? "mi-card-green" : "mi-card-neutral"}">
      <div class="mi-label">Avg Comparable Sale</div>
      <div class="mi-value">${avgPrice > 0 ? gbp(avgPrice) : "No data"}</div>
      <div class="mi-sub">${avgPrice > 0 ? `${valid.length} sales · saving ${gbp(saving)}` : "Run comparables to populate"}</div>
    </div>
    <div class="mi-card ${displayRent ? "mi-card-blue" : "mi-card-neutral"}">
      <div class="mi-label">Area Avg Monthly Rent</div>
      <div class="mi-value">${displayRent ? gbp(displayRent) : "—"}</div>
      <div class="mi-sub">${rentalMarket ? `Range: ${gbp(rentalMarket.confidenceRange.min)}–${gbp(rentalMarket.confidenceRange.max)} p/m` : avgCompRent ? `from ${rentComps.length} comparable${rentComps.length > 1 ? "s" : ""}` : "PropertyData estimate"}</div>
    </div>
    <div class="mi-card ${displayYield ? "mi-card-amber" : "mi-card-neutral"}">
      <div class="mi-label">${avgYield ? "Avg Comparable Yield" : "Implied Rental Yield"}</div>
      <div class="mi-value">${displayYield ? pct(displayYield, 2) : "—"}</div>
      <div class="mi-sub">${avgYield ? `across ${yieldComps.length} comp${yieldComps.length > 1 ? "s" : ""}` : displayYield ? "at area avg rent vs. purchase price" : "Add rental data to calculate"}</div>
    </div>
  </div>

  <!-- Portal Research Links -->
  ${showPortalLinks && postcode ? `
  <div class="portals-section">
    <div class="sub-heading" style="margin-bottom:8px;">Research This Area Online</div>
    <div class="portal-links">
      <a href="${rmSoldUrl}" class="portal-card portal-rm">
        <div class="portal-icon">&#127968;</div>
        <div class="portal-body">
          <div class="portal-name">Rightmove</div>
          <div class="portal-action">Sold Prices · ${outcode.toUpperCase()}</div>
          <div class="portal-url">${rmSoldUrl.slice(0, 55)}</div>
        </div>
        <div class="portal-arrow">&#8594;</div>
      </a>
      <a href="${rmSaleUrl}" class="portal-card portal-rm">
        <div class="portal-icon">&#128269;</div>
        <div class="portal-body">
          <div class="portal-name">Rightmove</div>
          <div class="portal-action">For Sale${beds ? ` · ${beds} Bed` : ""} · ${postcode}</div>
          <div class="portal-url">${rmSaleUrl.slice(0, 55)}…</div>
        </div>
        <div class="portal-arrow">&#8594;</div>
      </a>
      <a href="${zooplaUrl}" class="portal-card portal-zo">
        <div class="portal-icon">&#128200;</div>
        <div class="portal-body">
          <div class="portal-name">Zoopla</div>
          <div class="portal-action">House Prices · ${outcode.toUpperCase()}</div>
          <div class="portal-url">${zooplaUrl.slice(0, 55)}</div>
        </div>
        <div class="portal-arrow">&#8594;</div>
      </a>
      <a href="${govUrl}" class="portal-card portal-gov">
        <div class="portal-icon">&#128203;</div>
        <div class="portal-body">
          <div class="portal-name">HM Land Registry</div>
          <div class="portal-action">Price Paid · ${postcode}</div>
          <div class="portal-url">landregistry.data.gov.uk</div>
        </div>
        <div class="portal-arrow">&#8594;</div>
      </a>
    </div>
  </div>` : ""}

  ${noComps ? `
  <div class="no-data-panel" style="margin-top:20px;">
    <div class="no-data-icon">&#128202;</div>
    <div class="no-data-title">No comparable sales stored yet</div>
    <div class="no-data-sub">Open this deal in the vendor pipeline and run "Fetch Comparables" to populate rich market evidence. Market value assessed at <strong>${gbp(m.marketValue)}</strong>.</div>
  </div>` : `

  <!-- Comparable sales table -->
  <div style="margin-top:16px; margin-bottom:8px;" class="sub-heading">
    Comparable Sold Properties · ${dataSource}
  </div>
  <table class="comps-table">
    <thead>
      <tr>
        <th>Property</th>
        <th class="td-center">Type</th>
        <th class="td-center">Bed/Bath</th>
        ${useRich ? `<th class="td-right">Sq Ft</th>` : ""}
        <th class="td-right">Sold Price</th>
        <th class="td-right">Date</th>
        <th class="td-right">Distance</th>
        ${useRich ? `${showYieldColumn ? `<th class="td-right">Yield</th>` : ""}${showDaysOnMarket ? `<th class="td-center">DoM</th>` : ""}` : `<th class="td-right">vs. Subject</th>`}
        <th class="td-center">Links</th>
      </tr>
    </thead>
    <tbody>
      ${valid.map((c: any, i: number) => {
        const price   = Number(c.salePrice || c.price || 0)
        const dist    = useRich
          ? (c.distance ? Number(c.distance) : null)
          : (c.distanceKm ? Number(c.distanceKm) : null)
        const diff    = price - m.askingPrice
        const barPct  = maxPrice > 0 ? Math.round((price / maxPrice) * 100) : 0
        const compPc  = (c.postcode || "").trim()
        const yield_  = useRich && c.rentalYield ? Number(c.rentalYield) : null
        const dom     = useRich ? c.daysOnMarket : null
        const conf    = confInfo(c)

        // Portal links — rich comps have direct listing URLs; sparse comps use postcode lookup
        const rmLink  = useRich && c.listingUrl
          ? c.listingUrl
          : compPc ? `https://www.rightmove.co.uk/house-prices/${compPc.split(" ")[0].toLowerCase()}.html` : rmSoldUrl
        const zoLink  = useRich && c.listingUrlSecondary ? c.listingUrlSecondary : null

        return `<tr class="${i % 2 === 0 ? "tr-even" : ""}">
          <td class="comp-address">
            <div class="comp-addr-line">
              <a href="${rmLink}" class="comp-link">${c.address || "—"}</a>
              ${showConfidenceBadges ? `<span class="conf-badge ${conf.cls}">${conf.label}</span>` : ""}
            </div>
            ${compPc ? `<span class="comp-postcode">${compPc}</span>` : ""}
          </td>
          <td class="td-center" style="font-size:10.5px;text-transform:capitalize;">${c.propertyType || "—"}</td>
          <td class="td-center">${c.bedrooms ?? "—"}${c.bathrooms ? `<span class="bath-sep">/</span>${c.bathrooms}` : ""}</td>
          ${useRich ? `<td class="td-right text-muted">${c.squareFeet ? fmt(c.squareFeet) : "—"}</td>` : ""}
          <td class="td-right fw-bold">${gbp(price)}</td>
          <td class="td-right text-muted" style="white-space:nowrap;">${c.saleDate ? new Date(c.saleDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</td>
          <td class="td-right text-muted">${dist !== null ? `${dist.toFixed(1)} mi` : "—"}</td>
          ${useRich
            ? `${showYieldColumn ? `<td class="td-right ${yield_ ? "text-green fw-bold" : "text-muted"}">${yield_ ? pct(yield_, 2) : "—"}</td>` : ""}
               ${showDaysOnMarket ? `<td class="td-center text-muted">${dom ? `${dom}d` : "—"}</td>` : ""}`
            : `<td class="td-right ${diff > 0 ? "text-green" : "text-red"} fw-bold">${diff >= 0 ? "+" : ""}${gbp(diff)}</td>`}
          <td class="td-center">
            <div class="comp-portal-links">
              <a href="${rmLink}" class="cpl cpl-rm">RM</a>
              ${zoLink ? `<a href="${zoLink}" class="cpl cpl-zo">ZO</a>` : ""}
            </div>
          </td>
        </tr>`
      }).join("")}
      ${avgPrice > 0 ? `
      <tr class="comp-avg-row">
        <td colspan="${useRich ? 4 : 3}"><strong>Average comparable sale</strong></td>
        <td class="td-right fw-bold">${gbp(avgPrice)}</td>
        <td colspan="${useRich ? 4 : 3}" class="td-right text-green fw-bold">${saving > 0 ? `${pct(savingPct, 1)} below avg — saving ${gbp(saving)}` : `${pct(Math.abs(savingPct), 1)} above avg`}</td>
        <td></td>
      </tr>` : ""}
    </tbody>
  </table>

  <!-- Visual position bar -->
  ${avgPrice > 0 ? `
  <div class="value-bar-wrap" style="margin-top:12px;">
    <div class="value-bar-labels">
      <span>Subject purchase: ${gbp(m.askingPrice)}</span>
      <span>Comparable average: ${gbp(avgPrice)}</span>
    </div>
    <div class="value-bar-track">
      <div class="value-bar-fill" style="width:${pricePct.toFixed(0)}%">
        <span class="value-bar-pct">${pricePct.toFixed(0)}% of comp avg</span>
      </div>
    </div>
  </div>
  ${showAdvantageBox ? `<div class="market-advantage-box">
    <strong>Market Advantage:</strong> At ${gbp(m.askingPrice)}, this property is <strong>${pct(savingPct, 1)} below</strong> the comparable average of ${gbp(avgPrice)} — a saving of ${gbp(saving)} backed by ${useRich ? "live portal data" : "HM Land Registry records"}.${avgYield ? ` Comparable properties in this area achieve an average rental yield of <strong>${pct(avgYield, 2)}</strong>.` : ""}
  </div>` : ""}` : ""}

  <!-- Data confidence strip -->
  <div class="confidence-strip" style="margin-top:12px;">
    <div class="conf-item"><span class="conf-label">Data Source</span><span class="conf-value">${useRich ? "Rightmove / Zoopla / PropertyData" : "HM Land Registry"}</span></div>
    <div class="conf-item"><span class="conf-label">Search Radius</span><span class="conf-value">Up to 3 miles</span></div>
    <div class="conf-item"><span class="conf-label">Time Period</span><span class="conf-value">Last 12 months</span></div>
    <div class="conf-item"><span class="conf-label">Transactions</span><span class="conf-value">${valid.length} analysed</span></div>
    ${useRich && yieldComps.length > 0 ? `<div class="conf-item"><span class="conf-label">Avg Yield</span><span class="conf-value conf-high">${pct(avgYield!, 2)}</span></div>` : ""}
    <div class="conf-item"><span class="conf-label">Confidence</span><span class="conf-value conf-high">${useRich ? "VERIFIED" : "HIGH"}</span></div>
  </div>`}

  <div class="page-footer">
    <span>Market Evidence &amp; Comparables · ${postcode}</span>
    <span>Page 4</span>
  </div>
</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: CTA  (Final page — reserve / contact)
// ─────────────────────────────────────────────────────────────────────────────
function sectionCTA(deal: any, m: Metrics, company: CompanyInfo, cfg: Record<string,any> = {}): string {
  const showProcessSteps = cfg.showProcessSteps !== false
  const showUrgencyNote  = cfg.showUrgencyNote  !== false
  const urgencyText      = cfg.urgencyText?.trim()
    || `⚡ Deals of this calibre — ${pct(m.bmvPercentage)} below market value with ${gbp(m.profitPotential)} equity — are typically reserved within days of release. Act promptly to avoid missing this opportunity.`
  const showDisclaimer   = cfg.showDisclaimer   !== false

  const year = new Date().getFullYear()

  const secTitle = cfg.sectionTitle    || "Secure This Opportunity"
  const secSub   = cfg.sectionSubtitle || "Next steps to reserve this investment property"
  const s1Title  = cfg.step1Title || "Express Interest"
  const s1Desc   = cfg.step1Desc  || "Contact us to confirm your interest. Ask any questions about the property, area, or deal structure. We'll send you any additional information you need."
  const s2Title  = cfg.step2Title || "Due Diligence"
  const s2Desc   = cfg.step2Desc  || "Review the comparables, arrange a viewing, and conduct your independent assessment. We'll coordinate access and provide full seller disclosure documents."
  const s3Title  = cfg.step3Title || "Reserve &amp; Complete"
  const s3Desc   = cfg.step3Desc  || "Place your reservation, instruct your solicitor, and proceed to exchange. We'll support you through to successful completion at the agreed price."

  return `<div class="page content-page break-before">
  <div class="section-head">
    <div class="section-label">05</div>
    <div>
      <div class="section-title">${secTitle}</div>
      <div class="section-sub">${secSub}</div>
    </div>
  </div>

  <!-- Headline metrics recap -->
  <div class="cta-recap">
    <div class="recap-cell">
      <div class="recap-value">${gbp(m.askingPrice)}</div>
      <div class="recap-label">Purchase Price</div>
    </div>
    <div class="recap-cell recap-highlight">
      <div class="recap-value">${pct(m.bmvPercentage)}</div>
      <div class="recap-label">Below Market Value</div>
    </div>
    <div class="recap-cell recap-highlight">
      <div class="recap-value">${gbp(m.profitPotential)}</div>
      <div class="recap-label">Instant Equity</div>
    </div>
    ${m.grossYield > 0 ? `<div class="recap-cell">
      <div class="recap-value">${pct(m.grossYield, 2)}</div>
      <div class="recap-label">Gross Yield</div>
    </div>` : `<div class="recap-cell">
      <div class="recap-value">${gbp(m.totalInvestment)}</div>
      <div class="recap-label">Total Capital</div>
    </div>`}
  </div>

  <!-- 3-step process -->
  ${showProcessSteps ? `<div class="steps-row">
    <div class="step">
      <div class="step-num">01</div>
      <div class="step-content">
        <div class="step-title">${s1Title}</div>
        <div class="step-desc">${s1Desc}</div>
      </div>
    </div>
    <div class="step-arrow">→</div>
    <div class="step">
      <div class="step-num">02</div>
      <div class="step-content">
        <div class="step-title">${s2Title}</div>
        <div class="step-desc">${s2Desc}</div>
      </div>
    </div>
    <div class="step-arrow">→</div>
    <div class="step">
      <div class="step-num">03</div>
      <div class="step-content">
        <div class="step-title">${s3Title}</div>
        <div class="step-desc">${s3Desc}</div>
      </div>
    </div>
  </div>` : ""}

  <!-- Contact card -->
  <div class="contact-card">
    <div class="contact-card-left">
      <div class="contact-company">${company.name}</div>
      <div class="contact-tagline">Professional Property Investment Specialists</div>
    </div>
    <div class="contact-card-right">
      <div class="contact-detail">
        <span class="contact-icon">📞</span>
        <span>${company.phone}</span>
      </div>
      <div class="contact-detail">
        <span class="contact-icon">✉️</span>
        <span>${company.email}</span>
      </div>
      <div class="contact-detail">
        <span class="contact-icon">🌐</span>
        <span>${company.website}</span>
      </div>
    </div>
  </div>

  <!-- Urgency note -->
  ${showUrgencyNote ? `<div class="urgency-note">${urgencyText}</div>` : ""}

  <!-- Legal disclaimer -->
  ${showDisclaimer ? `<div class="disclaimer">
    This document is a confidential investment memorandum prepared by ${company.name} exclusively for the named recipient. All financial figures are estimates based on available market data and independent assessment. This document does not constitute financial advice. Independent legal, tax, and financial due diligence is strongly recommended before making any investment decision. Investment in property carries risk; capital is at risk and past performance is not a guarantee of future results. © ${year} ${company.name}. All rights reserved. Unauthorised reproduction or distribution is strictly prohibited.
  </div>` : ""}

  <div class="page-footer">
    <span>© ${year} ${company.name} · Confidential</span>
    <span>Page 5</span>
  </div>
</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — Full design system
// ─────────────────────────────────────────────────────────────────────────────

function buildCSS(template?: any, fontId = "system"): string {
  const palettes: Record<string, { p1: string; p2: string; p3: string; acc: string }> = {
    blue:   { p1: "#0f172a", p2: "#1e3a8a", p3: "#2563eb", acc: "#f59e0b" },
    slate:  { p1: "#0f172a", p2: "#1e40af", p3: "#3b82f6", acc: "#f59e0b" },
    green:  { p1: "#052e16", p2: "#065f46", p3: "#059669", acc: "#fbbf24" },
    purple: { p1: "#1e1b4b", p2: "#4c1d95", p3: "#7c3aed", acc: "#f59e0b" },
    gold:   { p1: "#1c1917", p2: "#78350f", p3: "#d97706", acc: "#fbbf24" },
  }
  const cs = palettes[template?.colorScheme] ?? palettes.blue
  const fontFamily = FONT_CSS[fontId] ?? FONT_CSS.system

  return `
/* ─── Reset & base ─────────────────────────────────────────── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: ${fontFamily};
  font-size: 13px;
  line-height: 1.55;
  color: #0f172a;
  background: white;
}

/* ─── Page containers ──────────────────────────────────────── */
.page { position: relative; width: 210mm; }
.break-before { break-before: page; page-break-before: always; }
.content-page { padding: 48px 56px 72px; }

/* ─── Page header (optional, injected by designer) ─────────── */
.page-header {
  display: flex;
  justify-content: space-between;
  font-size: 8.5px;
  color: #94a3b8;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 6px;
  margin-bottom: 14px;
  letter-spacing: 0.3px;
}

/* ─── Cover page ───────────────────────────────────────────── */
.cover-page {
  width: 210mm;
  height: 297mm;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: ${cs.p1};
}
.cover-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.28;
}
.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    160deg,
    rgba(${hexToRgb(cs.p1)},0.82) 0%,
    rgba(${hexToRgb(cs.p2)},0.72) 60%,
    rgba(${hexToRgb(cs.p3)},0.55) 100%
  );
}
.cover-body {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 48px 56px;
}
.cover-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: auto;
}
.cover-brand {
  font-size: 22px;
  font-weight: 900;
  color: ${cs.acc};
  letter-spacing: -0.3px;
}
.cover-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
  border: 1px solid rgba(255,255,255,0.25);
  padding: 7px 18px;
  border-radius: 100px;
  backdrop-filter: blur(8px);
}
.cover-headline {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px 0 32px;
}
.cover-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: ${cs.acc};
  margin-bottom: 16px;
}
.cover-address {
  font-size: 46px;
  font-weight: 900;
  color: white;
  line-height: 1.05;
  letter-spacing: -1px;
  margin-bottom: 14px;
  max-width: 520px;
}
.cover-subtitle {
  font-size: 16px;
  color: rgba(255,255,255,0.72);
  font-weight: 400;
}
/* KPI strip */
.cover-kpis {
  display: flex;
  gap: 0;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 28px;
  backdrop-filter: blur(12px);
}
.cover-kpi {
  flex: 1;
  padding: 20px 24px;
  border-right: 1px solid rgba(255,255,255,0.1);
  text-align: center;
}
.cover-kpi:last-child { border-right: none; }
.cover-kpi-value {
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 6px;
}
.cover-kpi-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  opacity: 0.7;
  color: white;
}
.kpi-white .cover-kpi-value { color: white; }
.kpi-green .cover-kpi-value { color: #4ade80; }
.kpi-gold  .cover-kpi-value { color: ${cs.acc}; }
.kpi-blue  .cover-kpi-value { color: #93c5fd; }

.cover-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  padding-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.12);
  letter-spacing: 0.5px;
}

/* ─── Section headers ──────────────────────────────────────── */
.section-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f1f5f9;
}
.section-label {
  font-size: 11px;
  font-weight: 900;
  color: ${cs.p3};
  letter-spacing: 2px;
  padding: 4px 10px;
  background: #eff6ff;
  border-radius: 6px;
  margin-top: 2px;
  white-space: nowrap;
}
.section-title {
  font-size: 28px;
  font-weight: 800;
  color: ${cs.p2};
  letter-spacing: -0.4px;
  line-height: 1.1;
}
.section-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 3px;
}
.sub-heading {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 10px;
}

/* ─── Photos ────────────────────────────────────────────────── */
.photo-hero-wrap {
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.10);
}
.photo-hero {
  width: 100%;
  height: 280px;
  object-fit: cover;
  display: block;
}
.photo-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}
.photo-grid-1 { grid-template-columns: 1fr; }
.photo-grid-2 { grid-template-columns: 1fr 1fr; }
.photo-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.photo-grid-img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.photo-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.photo-strip-img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

/* ─── Spec chips ─────────────────────────────────────────────── */
.spec-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}
.spec-chip {
  font-size: 11px;
  font-weight: 600;
  color: ${cs.p2};
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 4px 12px;
  border-radius: 100px;
}

/* ─── Features & description ────────────────────────────────── */
.property-details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  margin-top: 16px;
}
.features-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.feature-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #374151;
  line-height: 1.4;
}
.feature-tick {
  color: #059669;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.listing-desc {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.65;
}

/* ─── Metric hero strip ─────────────────────────────────────── */
.metrics-hero-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
  border: 1px solid #1e3a8a;
}
.mh-cell {
  padding: 20px 18px;
  border-right: 1px solid rgba(255,255,255,0.12);
}
.mh-cell:last-child { border-right: none; }
.mh-dark  {
  background: linear-gradient(135deg, ${cs.p1} 0%, ${cs.p2} 100%);
  color: white;
}
.mh-border { border-left: 1px solid rgba(255,255,255,0.15); }
.mh-green {
  background: linear-gradient(135deg, #065f46 0%, #059669 100%);
  color: white;
}
.mh-gold {
  background: linear-gradient(135deg, #78350f 0%, #d97706 100%);
  color: white;
}
.mh-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.7;
  color: inherit;
  margin-bottom: 8px;
}
.mh-value {
  font-size: 25px;
  font-weight: 900;
  color: inherit;
  line-height: 1;
  margin-bottom: 6px;
}
.mh-note {
  font-size: 10px;
  opacity: 0.65;
  color: inherit;
}

/* ─── Secondary metric strip ─────────────────────────────────── */
.metrics-secondary-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 22px;
}
.ms-cell {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  position: relative;
  overflow: hidden;
}
.ms-cell::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
}
.ms-blue::before  { background: #3b82f6; }
.ms-amber::before { background: #f59e0b; }
.ms-icon {
  font-size: 16px;
  font-weight: 900;
  color: #cbd5e1;
  position: absolute;
  top: 12px; right: 14px;
}
.ms-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #94a3b8;
  margin-bottom: 6px;
}
.ms-value {
  font-size: 21px;
  font-weight: 900;
  color: ${cs.p2};
  line-height: 1;
  margin-bottom: 3px;
}
.ms-blue  .ms-value { color: #2563eb; }
.ms-amber .ms-value { color: #d97706; }
.ms-note {
  font-size: 10px;
  color: #94a3b8;
}

/* ─── Analysis two-col layout ───────────────────────────────── */
.analysis-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}
.analysis-col {}

/* Cost table */
.cost-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 12.5px;
}
.cost-table td {
  padding: 9px 0;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
}
.cost-table tr:last-of-type:not(.cost-total) td { border-bottom: none; }
.cost-total td {
  border-top: 2px solid ${cs.p3};
  border-bottom: none;
  padding-top: 10px;
  font-weight: 800;
  font-size: 14px;
  color: ${cs.p2};
}
.td-right { text-align: right; }
.fw-bold   { font-weight: 700; }
.text-muted { color: #94a3b8; }
.text-green { color: #059669; }
.text-red   { color: #dc2626; }

/* Value bar */
.value-bar-wrap { margin: 16px 0; }
.value-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}
.value-bar-track {
  height: 18px;
  background: #e2e8f0;
  border-radius: 9px;
  overflow: hidden;
}
.value-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, ${cs.p3} 0%, ${cs.p2} 100%);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  min-width: 36px;
}
.value-bar-pct {
  font-size: 10px;
  font-weight: 800;
  color: white;
}
.equity-callout {
  margin-top: 8px;
  font-size: 11px;
  display: flex;
  align-items: baseline;
  gap: 5px;
  flex-wrap: wrap;
}
.equity-label { color: #64748b; font-weight: 600; }
.equity-num   { color: #059669; font-weight: 900; font-size: 15px; }
.equity-note  { color: #94a3b8; }

/* ARV grid */
.arv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.arv-cell { padding: 12px 14px; text-align: center; }
.arv-cell-mid  { border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
.arv-cell-last { background: #f0fdf4; }
.arv-label { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.arv-value { font-size: 18px; font-weight: 900; color: ${cs.p1}; }
.arv-blue  { color: #2563eb; }
.arv-green { color: #059669; }

/* ─── Cashflow ──────────────────────────────────────────────── */
.cashflow-hero {
  display: flex;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
}
.cf-hero-left, .cf-hero-right {
  flex: 1;
  padding: 16px 18px;
}
.cf-hero-left  { background: linear-gradient(135deg, ${cs.p2} 0%, ${cs.p3} 100%); color: white; }
.cf-hero-right { background: #f8fafc; border-left: 1px solid #e2e8f0; }
.cf-hero-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.8;
  margin-bottom: 4px;
}
.cf-hero-right .cf-hero-label { color: #64748b; }
.cf-hero-value {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 3px;
}
.cf-gross { color: ${cs.p2}; }
.cf-hero-right .cf-hero-value { color: ${cs.p1}; }
.cf-hero-sub { font-size: 10px; opacity: 0.75; }
.cf-hero-right .cf-hero-sub { color: #94a3b8; }

/* Waterfall */
.waterfall { margin: 10px 0; }
.wf-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 3px 0;
  font-size: 12px;
}
.wf-income { background: #f0fdf4; }
.wf-cost   { background: #fef2f2; }
.wf-net    {
  background: ${cs.p2};
  color: white;
  font-weight: 700;
  font-size: 13px;
  border-radius: 8px;
  margin-top: 6px;
  padding: 10px 12px;
}
.wf-label  { color: #374151; font-weight: 500; }
.wf-amount { font-weight: 700; }
.wf-pos    { color: #059669; }
.wf-neg    { color: #dc2626; }

.payback-note {
  font-size: 11px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 3px solid #f59e0b;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 8px 0;
}

/* Scenario table */
.scenario-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
}
.scenario-table th {
  background: ${cs.p2};
  color: white;
  padding: 8px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.scenario-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
}
.scenario-table tr:last-child td { border-bottom: none; }
.sc-base td {
  background: #eff6ff;
  font-weight: 700;
  color: ${cs.p2};
}
.td-center { text-align: center; }

/* ROI block (when no rent data) */
.roi-block {
  background: linear-gradient(135deg, ${cs.p2} 0%, ${cs.p3} 100%);
  color: white;
  padding: 28px;
  border-radius: 14px;
  text-align: center;
}
.roi-big   { font-size: 56px; font-weight: 900; line-height: 1; margin-bottom: 8px; }
.roi-sub   { font-size: 14px; opacity: 0.85; margin-bottom: 6px; }
.roi-desc  { font-size: 11px; opacity: 0.7; }

/* ─── Comparables ───────────────────────────────────────────── */
.advantage-banner {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
  border-left: 4px solid #16a34a;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}
.adv-stat { text-align: center; min-width: 80px; }
.adv-value { font-size: 24px; font-weight: 900; color: #15803d; line-height: 1; }
.adv-label { font-size: 10px; color: #166534; font-weight: 600; margin-top: 3px; }
.adv-divider { width: 1px; background: #86efac; align-self: stretch; }
.adv-text {
  flex: 1;
  font-size: 12px;
  color: #166534;
  line-height: 1.5;
  display: flex;
  align-items: center;
  min-width: 200px;
  padding-left: 8px;
}
.comps-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  font-size: 11.5px;
  margin-bottom: 16px;
}
.comps-table th {
  background: ${cs.p2};
  color: white;
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: left;
}
.comps-table td {
  padding: 9px 12px;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}
.tr-even td  { background: #f8fafc; }
.comp-address { font-weight: 500; line-height: 1.3; }
.comp-postcode { display: block; font-size: 9.5px; color: #94a3b8; margin-top: 2px; }
.comp-avg-row td {
  background: #eff6ff;
  font-weight: 700;
  color: ${cs.p2};
  border-top: 2px solid ${cs.p3};
  border-bottom: none;
}
.confidence-strip {
  display: flex;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 12px;
}
.conf-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
}
.conf-item:last-child { border-right: none; }
.conf-label { font-size: 9.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
.conf-value { font-size: 12px; font-weight: 700; color: #334155; }
.conf-high  { color: #16a34a !important; }

/* No data panel */
.no-data-panel {
  text-align: center;
  padding: 60px 40px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.no-data-icon  { font-size: 40px; margin-bottom: 16px; }
.no-data-title { font-size: 16px; font-weight: 700; color: #334155; margin-bottom: 8px; }
.no-data-sub   { font-size: 13px; color: #64748b; }

/* ─── CTA page ──────────────────────────────────────────────── */
.cta-recap {
  display: flex;
  gap: 0;
  background: linear-gradient(135deg, ${cs.p1} 0%, ${cs.p2} 100%);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 28px;
  color: white;
}
.recap-cell {
  flex: 1;
  padding: 24px 20px;
  text-align: center;
  border-right: 1px solid rgba(255,255,255,0.1);
}
.recap-cell:last-child { border-right: none; }
.recap-highlight { background: rgba(255,255,255,0.06); }
.recap-value {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 6px;
  color: ${cs.acc};
}
.recap-highlight .recap-value { color: #4ade80; }
.recap-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  opacity: 0.7;
}

/* 3-step process */
.steps-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin-bottom: 28px;
}
.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.step-num {
  font-size: 40px;
  font-weight: 900;
  color: ${cs.p3};
  opacity: 0.25;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.step-title {
  font-size: 15px;
  font-weight: 800;
  color: ${cs.p2};
  margin-bottom: 6px;
}
.step-desc {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.6;
}
.step-arrow {
  font-size: 22px;
  color: #cbd5e1;
  padding: 0 16px;
  align-self: center;
  margin-bottom: 32px;
}

/* Contact card */
.contact-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${cs.p2};
  color: white;
  padding: 28px 32px;
  border-radius: 14px;
  margin-bottom: 16px;
  gap: 32px;
}
.contact-company {
  font-size: 22px;
  font-weight: 900;
  margin-bottom: 4px;
  color: ${cs.acc};
}
.contact-tagline {
  font-size: 11px;
  opacity: 0.7;
  font-weight: 500;
}
.contact-card-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.contact-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}
.contact-icon { font-size: 14px; }

.urgency-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid ${cs.acc};
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 11.5px;
  color: #78350f;
  line-height: 1.5;
  margin-bottom: 16px;
}

/* ─── Footer & disclaimer ───────────────────────────────────── */
.page-footer {
  position: absolute;
  bottom: 24px;
  left: 56px;
  right: 56px;
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: #94a3b8;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  letter-spacing: 0.3px;
}
.disclaimer {
  font-size: 9px;
  color: #94a3b8;
  line-height: 1.55;
  text-align: center;
  margin-top: 4px;
}

/* ─── Market intelligence grid ──────────────────────────────── */
.market-intel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.mi-card {
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  border-top: 3px solid #e2e8f0;
}
.mi-card-primary { border-top-color: ${cs.p3}; background: #eff6ff; }
.mi-card-green   { border-top-color: #10b981; background: #f0fdf4; }
.mi-card-blue    { border-top-color: #3b82f6; background: #eff6ff; }
.mi-card-amber   { border-top-color: #f59e0b; background: #fffbeb; }
.mi-card-neutral { border-top-color: #94a3b8; background: #f8fafc; }
.mi-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
.mi-value { font-size: 20px; font-weight: 900; color: ${cs.p2}; line-height: 1; margin-bottom: 4px; }
.mi-card-green  .mi-value { color: #059669; }
.mi-card-blue   .mi-value { color: #2563eb; }
.mi-card-amber  .mi-value { color: #d97706; }
.mi-sub   { font-size: 10px; color: #94a3b8; line-height: 1.3; }

/* ─── Portal research links ─────────────────────────────────── */
.portals-section { margin: 16px 0; }
.portals-note {
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 3px solid ${cs.p3};
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 12px;
}
.portal-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.portal-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  text-decoration: none;
  color: inherit;
  transition: none;
}
.portal-rm  { border-left: 3px solid #d7202f; }
.portal-zo  { border-left: 3px solid #8c43c2; }
.portal-gov { border-left: 3px solid #005ea5; }
.portal-icon { font-size: 20px; flex-shrink: 0; }
.portal-body { flex: 1; min-width: 0; }
.portal-name   { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 2px; }
.portal-action { font-size: 12px; font-weight: 700; color: ${cs.p2}; margin-bottom: 2px; }
.portal-url    { font-size: 9.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.portal-arrow  { font-size: 16px; color: #cbd5e1; flex-shrink: 0; }

/* Comparable address link */
.comp-link { color: ${cs.p2}; text-decoration: none; font-weight: 600; }

/* Inline price bar */
.comp-bar-track {
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}
.comp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, ${cs.p3} 0%, ${cs.p2} 100%);
  border-radius: 4px;
  min-width: 4px;
}

/* Market advantage box */
.market-advantage-box {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-left: 4px solid #16a34a;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 12px;
  color: #166534;
  line-height: 1.5;
  margin-top: 12px;
}

/* ─── Comparable address line & confidence badge ────────────── */
.comp-addr-line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  flex-wrap: wrap;
}
.conf-badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.cb-high { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
.cb-med  { background: #fef9c3; color: #713f12; border: 1px solid #fde047; }
.cb-low  { background: #fee2e2; color: #7f1d1d; border: 1px solid #fca5a5; }
.bath-sep { color: #94a3b8; margin: 0 1px; font-size: 10px; }

/* ─── Per-property portal link badges ──────────────────────── */
.comp-portal-links {
  display: flex;
  gap: 3px;
  justify-content: center;
}
.cpl {
  display: inline-block;
  font-size: 8.5px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.cpl-rm  { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
.cpl-zo  { background: #ede9fe; color: #6d28d9; border: 1px solid #c4b5fd; }

/* ─── Rich data badge ───────────────────────────────────────── */
.rich-data-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 800;
  color: #059669;
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  padding: 4px 12px;
  border-radius: 100px;
  white-space: nowrap;
  align-self: center;
}

/* ─── Print ─────────────────────────────────────────────────── */
@media print {
  .page { page-break-inside: avoid; }
  .break-before { page-break-before: always; }
}
`
}

// ─── Utility: hex → RGB ──────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

// ─── Puppeteer ───────────────────────────────────────────────────────────────

async function htmlToPDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 })
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 })
    // Brief wait for fonts/images to settle after networkidle
    await new Promise(r => setTimeout(r, 500))
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
