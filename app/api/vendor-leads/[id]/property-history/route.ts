/**
 * GET /api/vendor-leads/[id]/property-history
 *
 * Fetches a rich property history intelligence package:
 *   - Sold price history  (PropertyData /sold-prices, filtered to subject address)
 *   - Listing history     (PropertyData /listing-history)
 *   - EPC history         (MHCLG open EPC register, free, no key required)
 *   - Ownership intel     (company_ownership table already imported)
 *   - Market comparison   (average area price from nearby sold prices)
 *   - Distress score      (0-100 composite from all signals)
 *
 * Results cached on vendor_leads.property_history for 7 days.
 * Pass ?force=true to bypass cache.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession }          from "next-auth"
import { authOptions }               from "@/lib/auth"
import { prisma }                    from "@/lib/db"
import { fetchSoldPrices, fetchListingHistory } from "@/lib/propertydata"

// ── EPC open-data API (free, no key) ──────────────────────────────────────────
async function fetchEpcHistory(postcode: string, address: string): Promise<EpcRecord[]> {
  try {
    const params = new URLSearchParams({ postcode, size: "10" })
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?${params}`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const rows: any[] = data.rows ?? []

    // Filter to this address (fuzzy: postcode match + address substring)
    const addressLower = address.toLowerCase()
    const matched = rows.filter((r) => {
      const rAddr = ((r["address1"] ?? "") + " " + (r["address2"] ?? "")).toLowerCase()
      return rAddr.includes(addressLower.split(",")[0].trim().toLowerCase())
    })
    const target = matched.length > 0 ? matched : rows.slice(0, 3)

    return target.map((r) => ({
      lodgementDate:      r["lodgement-date"]        ?? r["inspection-date"]  ?? null,
      currentRating:      r["current-energy-rating"] ?? null,
      currentScore:       r["current-energy-efficiency"] ? Number(r["current-energy-efficiency"]) : null,
      potentialRating:    r["potential-energy-rating"] ?? null,
      potentialScore:     r["potential-energy-efficiency"] ? Number(r["potential-energy-efficiency"]) : null,
      propertyType:       r["property-type"]          ?? null,
      builtForm:          r["built-form"]              ?? null,
      wallsDescription:   r["walls-description"]       ?? null,
      roofDescription:    r["roof-description"]        ?? null,
      heatingType:        r["main-heat-description"]   ?? null,
      glazingType:        r["windows-description"]     ?? null,
      address:            [r["address1"], r["address2"]].filter(Boolean).join(", "),
    }))
  } catch {
    return []
  }
}

// ── Ownership lookup from local DB ─────────────────────────────────────────────
async function fetchOwnershipIntel(postcode: string) {
  try {
    const norm = postcode.toUpperCase().replace(/\s+/g, "")
    const records = await prisma.companyOwnership.findMany({
      where: { postcodeNormalized: norm },
      take: 5,
      orderBy: { importedAt: "desc" },
    })
    return records.map((r) => ({
      companyName:         r.companyName,
      companyRegNumber:    r.companyRegNumber,
      proprietorCategory:  r.proprietorCategory,
      countryIncorporated: r.countryIncorporated,
      isOverseas:          r.isOverseas,
      tenure:              r.tenure,
      dateProprietary:     r.dateProprietary,
      pricePaid:           r.pricePaid ? Number(r.pricePaid) : null,
    }))
  } catch {
    return []
  }
}

// ── Address normalisation for sold-price matching ─────────────────────────────
function normaliseAddress(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()
}

function addressMatch(candidateAddr: string, subjectAddr: string): boolean {
  const c = normaliseAddress(candidateAddr)
  const s = normaliseAddress(subjectAddr)
  // Extract first token (house number / name) + first word of street
  const firstTokens = (str: string) => str.split(/\s+/).slice(0, 2).join(" ")
  return c.includes(firstTokens(s)) || s.includes(firstTokens(c))
}

// ── Distress score ─────────────────────────────────────────────────────────────
interface DistressInput {
  daysOnMarket:      number
  totalReductions:   number
  totalReductionAmt: number
  askingPrice:       number
  timesListed:       number
  hasFailedSale:     boolean
  isCorporateOwner:  boolean
  lastSoldPrice:     number | null
  lastSoldDate:      string | null
  soldBelowAverage:  boolean
}

function computeDistressScore(d: DistressInput): { score: number; signals: string[] } {
  let score   = 0
  const signals: string[] = []

  if (d.daysOnMarket >= 90) {
    score += 20
    signals.push(`${d.daysOnMarket} days on market (90+ day threshold)`)
  } else if (d.daysOnMarket >= 45) {
    score += 10
    signals.push(`${d.daysOnMarket} days on market`)
  }

  if (d.totalReductions >= 2) {
    score += 20
    signals.push(`${d.totalReductions} price reductions`)
  } else if (d.totalReductions === 1) {
    score += 10
    signals.push("1 price reduction")
  }

  if (d.totalReductions > 0 && d.askingPrice > 0) {
    const pct = Math.round((d.totalReductionAmt / (d.askingPrice + d.totalReductionAmt)) * 100)
    if (pct >= 10) {
      score += 15
      signals.push(`Reduced ${pct}% from original asking`)
    }
  }

  if (d.hasFailedSale) {
    score += 25
    signals.push("Re-listed after previous withdrawal (likely failed sale)")
  }

  if (d.timesListed >= 3) {
    score += 15
    signals.push(`Listed ${d.timesListed} times across portals`)
  } else if (d.timesListed === 2) {
    score += 8
    signals.push("Listed on 2 separate occasions")
  }

  if (d.isCorporateOwner) {
    score += 10
    signals.push("Corporate/estate vendor — financially motivated")
  }

  if (d.soldBelowAverage) {
    score += 10
    signals.push("Last sold below area average — may accept less again")
  }

  return { score: Math.min(score, 100), signals }
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface EpcRecord {
  lodgementDate:    string | null
  currentRating:    string | null
  currentScore:     number | null
  potentialRating:  string | null
  potentialScore:   number | null
  propertyType:     string | null
  builtForm:        string | null
  wallsDescription: string | null
  roofDescription:  string | null
  heatingType:      string | null
  glazingType:      string | null
  address:          string
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const force = request.nextUrl.searchParams.get("force") === "true"

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        id:               true,
        propertyAddress:  true,
        propertyPostcode: true,
        askingPrice:      true,
        bedrooms:         true,
        propertyType:     true,
        propertyHistory:  true,
        propertyHistoryAt:true,
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // ── Cache check (7 days) ──────────────────────────────────────────────────
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
    if (
      !force &&
      lead.propertyHistory &&
      lead.propertyHistoryAt &&
      Date.now() - new Date(lead.propertyHistoryAt).getTime() < CACHE_TTL_MS
    ) {
      return NextResponse.json({ cached: true, data: lead.propertyHistory })
    }

    const postcode = lead.propertyPostcode ?? ""
    const address  = lead.propertyAddress  ?? ""
    if (!postcode) {
      return NextResponse.json({ error: "No postcode on this lead" }, { status: 400 })
    }

    // ── Parallel fetch ────────────────────────────────────────────────────────
    const [soldResult, listingHistResult, epcRecords, ownershipRecords] = await Promise.all([
      fetchSoldPrices(postcode, undefined, 0.25, 100),
      fetchListingHistory(postcode, 0.1),
      fetchEpcHistory(postcode, address),
      fetchOwnershipIntel(postcode),
    ])

    // ── Sold price history — filter to subject property ───────────────────────
    const allSold = soldResult?.soldProperties ?? []
    const subjectSold = allSold.filter((s) => addressMatch(s.address, address))
    // If too few exact matches, widen to postcode-level (same street / closest 5)
    const soldHistory = subjectSold.length > 0
      ? subjectSold
      : allSold.slice(0, 5) // fallback: nearby as area baseline

    // Area average from ALL sold in radius
    const areaAvgPrice =
      allSold.length > 0
        ? Math.round(allSold.reduce((sum, s) => sum + s.salePrice, 0) / allSold.length)
        : null

    // Subject property sold prices only (exact address)
    const subjectTransactions = subjectSold.sort(
      (a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
    )

    // First and last transaction for gain/loss calc
    const firstTx = subjectTransactions[0]  ?? null
    const lastTx  = subjectTransactions[subjectTransactions.length - 1] ?? null
    const gainPct =
      firstTx && lastTx && firstTx.salePrice > 0
        ? Math.round(((lastTx.salePrice - firstTx.salePrice) / firstTx.salePrice) * 100)
        : null

    // Flip detection: any two consecutive transactions < 18 months apart
    const flips = subjectTransactions.reduce<{ buyPrice: number; sellPrice: number; buyDate: string; sellDate: string; gainPct: number }[]>((acc, tx, i) => {
      if (i === 0) return acc
      const prev = subjectTransactions[i - 1]
      const months = (new Date(tx.saleDate).getTime() - new Date(prev.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (months <= 18) {
        acc.push({
          buyPrice:  prev.salePrice,
          sellPrice: tx.salePrice,
          buyDate:   prev.saleDate,
          sellDate:  tx.saleDate,
          gainPct:   Math.round(((tx.salePrice - prev.salePrice) / prev.salePrice) * 100),
        })
      }
      return acc
    }, [])

    // ── Listing history ───────────────────────────────────────────────────────
    const allListings = listingHistResult?.history ?? []
    const subjectListings = allListings.filter((l) => addressMatch(l.address, address))
    const listingsToShow = subjectListings.length > 0 ? subjectListings : allListings.slice(0, 3)

    const totalReductions    = listingsToShow.reduce((s, l) => s + (l.priceReductions ?? 0), 0)
    const maxDaysListed      = Math.max(0, ...listingsToShow.map((l) => l.daysListed ?? 0))
    const originalListingPrice = listingsToShow.length > 0
      ? Math.max(...listingsToShow.map((l) => l.listedPrice))
      : null
    const totalReductionAmt  = originalListingPrice && lead.askingPrice
      ? Math.max(0, originalListingPrice - Number(lead.askingPrice))
      : 0
    const hasFailedSale      = listingsToShow.some((l) => l.dateRemoved && !l.finalPrice)

    // ── Distress score ────────────────────────────────────────────────────────
    const isCorporate = ownershipRecords.some((o) => o.companyName)
    const soldBelowAvg =
      lastTx && areaAvgPrice !== null ? lastTx.salePrice < areaAvgPrice : false

    const { score: distressScore, signals: distressSignals } = computeDistressScore({
      daysOnMarket:      maxDaysListed,
      totalReductions,
      totalReductionAmt,
      askingPrice:       Number(lead.askingPrice ?? 0),
      timesListed:       subjectListings.length,
      hasFailedSale,
      isCorporateOwner:  isCorporate,
      lastSoldPrice:     lastTx?.salePrice ?? null,
      lastSoldDate:      lastTx?.saleDate  ?? null,
      soldBelowAverage:  soldBelowAvg,
    })

    // ── Assemble output ───────────────────────────────────────────────────────
    const result = {
      address,
      postcode,
      fetchedAt: new Date().toISOString(),

      soldHistory: {
        transactions:     subjectTransactions,
        transactionCount: subjectTransactions.length,
        firstSalePrice:   firstTx?.salePrice ?? null,
        firstSaleDate:    firstTx?.saleDate  ?? null,
        lastSalePrice:    lastTx?.salePrice  ?? null,
        lastSaleDate:     lastTx?.saleDate   ?? null,
        gainPct,
        flips,
        areaAvgPrice,
        soldBelowAreaAvg: soldBelowAvg,
      },

      listingHistory: {
        listings:             listingsToShow,
        count:                listingsToShow.length,
        totalReductions,
        totalReductionAmount: totalReductionAmt,
        maxDaysOnMarket:      maxDaysListed,
        hasFailedSale,
        originalListingPrice,
      },

      epc: {
        records:          epcRecords,
        latestRating:     epcRecords[0]?.currentRating     ?? null,
        latestScore:      epcRecords[0]?.currentScore      ?? null,
        potentialRating:  epcRecords[0]?.potentialRating   ?? null,
        potentialScore:   epcRecords[0]?.potentialScore    ?? null,
        ratingHistory:    epcRecords.map((e) => ({ date: e.lodgementDate, rating: e.currentRating, score: e.currentScore })),
        improvementGap:   epcRecords[0] && epcRecords[0].potentialScore && epcRecords[0].currentScore
          ? epcRecords[0].potentialScore - epcRecords[0].currentScore
          : null,
      },

      ownership: {
        records:        ownershipRecords,
        isCorporate,
        isOverseas:     ownershipRecords.some((o) => o.isOverseas),
        companyName:    ownershipRecords[0]?.companyName ?? null,
        companyRegNo:   ownershipRecords[0]?.companyRegNumber ?? null,
      },

      distress: {
        score:   distressScore,
        label:   distressScore >= 60 ? "High" : distressScore >= 30 ? "Moderate" : "Low",
        signals: distressSignals,
      },
    }

    // ── Persist cache ─────────────────────────────────────────────────────────
    await prisma.vendorLead.update({
      where: { id: params.id },
      data: { propertyHistory: result as any, propertyHistoryAt: new Date() },
    })

    return NextResponse.json({ cached: false, data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[property-history]", message)
    return NextResponse.json({ error: "Failed to fetch property history", detail: message }, { status: 500 })
  }
}
