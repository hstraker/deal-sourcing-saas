/**
 * Freeholds Check
 * Calls PropertyData /freeholds endpoint to return freehold land title numbers
 * at the property's postcode, with leasehold counts per polygon.
 *
 * Then calls /title on the nearest freehold to get:
 *   - The list of leasehold title numbers in the building
 *   - Ownership type (private individual vs corporate)
 *   - Plot size and UPRNs
 *
 * Infers tenure (freehold vs leasehold) from the nearest polygon's leasehold count.
 */

import type { PortalFlag } from './portal-listing-check'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreeholdsTitle {
  titleNumber: string
  titleClass: string
  leaseholds: number        // number of leaseholds under this freehold
  distance: string          // distance from postcode centre (km)
  lat: number
  lng: number
  polygonId: number
}

export interface TitleDetail {
  titleNumber: string
  titleClass: string
  estateInterest: string
  ownershipType: string          // "Private individual" | "Corporate body" | etc.
  ownerName?: string             // corporate owner name if applicable
  plotSizeAcres: string | null
  leaseholdTitleNumbers: string[]  // leasehold titles attached to this freehold
  uprns: number[]
}

export interface FreeholdsResult {
  inferredTenure: 'freehold' | 'leasehold' | 'unknown'
  nearestTitle: FreeholdsTitle | null
  nearestTitleDetail: TitleDetail | null   // /title data for the nearest freehold
  allTitles: FreeholdsTitle[]
  resultCount: number
  flags: PortalFlag[]
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface PropertyDataFreeholdsResponse {
  status: string
  postcode?: string
  result_count?: number
  data?: Array<{
    title_number: string
    class: string
    num_polygons: number
    polygons: Array<{
      id: number
      lat: number
      lng: number
      distance: string
      num_points: number
      leaseholds: number
    }>
  }>
  message?: string
}

interface PropertyDataTitleResponse {
  status: string
  title_number?: string
  data?: {
    class: string
    estate_interest: string
    ownership: {
      type: string
      corporate?: { name?: string }
    }
    plot_size?: string
    polygon_count?: number
    polygons?: Array<{
      polygon_size: string
      approx_centre: { lat: number; lng: number }
      coords: Array<{ lat: number; lng: number }>
    }>
    leaseholds?: string[]    // leasehold title numbers attached to this freehold
    uprns?: number[]
  }
  message?: string
}

// ---------------------------------------------------------------------------
// Fetch /title details for a given title number
// ---------------------------------------------------------------------------

async function fetchTitleDetail(titleNumber: string, apiKey: string): Promise<TitleDetail | null> {
  try {
    const url = `https://api.propertydata.co.uk/title?key=${apiKey}&title=${encodeURIComponent(titleNumber)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const json: PropertyDataTitleResponse = await res.json()
    if (json.status !== 'success' || !json.data) return null

    const d = json.data
    return {
      titleNumber,
      titleClass: d.class,
      estateInterest: d.estate_interest,
      ownershipType: d.ownership.type,
      ownerName: d.ownership.corporate?.name ?? undefined,
      plotSizeAcres: d.plot_size ?? null,
      leaseholdTitleNumbers: d.leaseholds ?? [],
      uprns: d.uprns ?? [],
    }
  } catch (err: any) {
    console.warn(`[FreeholdsCheck] /title fetch failed for ${titleNumber}:`, err?.message)
    return null
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function runFreeholdsCheck({
  postcode,
  isMock = false,
}: {
  postcode: string
  isMock?: boolean
}): Promise<FreeholdsResult> {
  if (!postcode) {
    return { inferredTenure: 'unknown', nearestTitle: null, nearestTitleDetail: null, allTitles: [], resultCount: 0, flags: [] }
  }

  if (isMock) {
    return getMockFreeholdsResult()
  }

  const apiKey = process.env.PROPERTYDATA_API_KEY
  if (!apiKey) {
    console.warn('[FreeholdsCheck] PROPERTYDATA_API_KEY not set — skipping freeholds check')
    return { inferredTenure: 'unknown', nearestTitle: null, nearestTitleDetail: null, allTitles: [], resultCount: 0, flags: [] }
  }

  try {
    // Step 1: /freeholds — get all freehold titles at this postcode
    const url = `https://api.propertydata.co.uk/freeholds?key=${apiKey}&postcode=${encodeURIComponent(postcode)}&results=10`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`PropertyData /freeholds HTTP ${res.status}`)
    const json: PropertyDataFreeholdsResponse = await res.json()

    if (json.status !== 'success' || !json.data?.length) {
      return { inferredTenure: 'unknown', nearestTitle: null, nearestTitleDetail: null, allTitles: [], resultCount: 0, flags: [] }
    }

    // Flatten polygons into list sorted by distance ascending
    const allTitles: FreeholdsTitle[] = json.data
      .flatMap((title) =>
        title.polygons.map((poly) => ({
          titleNumber: title.title_number,
          titleClass: title.class,
          leaseholds: poly.leaseholds,
          distance: poly.distance,
          lat: poly.lat,
          lng: poly.lng,
          polygonId: poly.id,
        }))
      )
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))

    const nearest = allTitles[0] ?? null

    // Step 2: /title — get detailed info on the nearest freehold (1 API credit)
    // Only call if it looks like a leasehold building (leaseholds > 0)
    let nearestTitleDetail: TitleDetail | null = null
    if (nearest) {
      nearestTitleDetail = await fetchTitleDetail(nearest.titleNumber, apiKey)
    }

    // Infer tenure:
    // - Nearest polygon has leaseholds > 0  → building has sub-leases → unit likely leasehold
    // - Nearest polygon has leaseholds === 0 → likely a freehold house
    const inferredTenure: FreeholdsResult['inferredTenure'] =
      nearest == null
        ? 'unknown'
        : nearest.leaseholds > 0
        ? 'leasehold'
        : 'freehold'

    const flags: PortalFlag[] = buildFreeholdsFlags(inferredTenure, nearest, nearestTitleDetail)

    return {
      inferredTenure,
      nearestTitle: nearest,
      nearestTitleDetail,
      allTitles,
      resultCount: json.result_count ?? allTitles.length,
      flags,
    }
  } catch (err: any) {
    console.error('[FreeholdsCheck] Error:', err?.message)
    return { inferredTenure: 'unknown', nearestTitle: null, nearestTitleDetail: null, allTitles: [], resultCount: 0, flags: [] }
  }
}

// ---------------------------------------------------------------------------
// Flag builder
// ---------------------------------------------------------------------------

function buildFreeholdsFlags(
  tenure: FreeholdsResult['inferredTenure'],
  nearest: FreeholdsTitle | null,
  detail: TitleDetail | null,
): PortalFlag[] {
  const flags: PortalFlag[] = []

  if (tenure === 'leasehold') {
    const count = nearest?.leaseholds ?? 0
    const titleRef = nearest?.titleNumber ?? 'unknown'
    flags.push({
      code: 'LIKELY_LEASEHOLD',
      severity: 'caution',
      label: 'Likely Leasehold Property',
      detail: `Freehold title ${titleRef} has ${count} leasehold${count !== 1 ? 's' : ''} — confirm lease years, ground rent and service charge before proceeding.`,
    })
  }

  // Flag corporate freehold ownership (can affect management quality)
  if (detail?.ownershipType?.toLowerCase().includes('corporate')) {
    flags.push({
      code: 'CORPORATE_FREEHOLDER',
      severity: 'caution',
      label: 'Corporate Freeholder',
      detail: `Freehold owned by ${detail.ownerName ?? 'a corporate body'} — check for escalating ground rent, service charge disputes or Section 20 notices.`,
    })
  }

  return flags
}

// ---------------------------------------------------------------------------
// Mock data (for test mode)
// ---------------------------------------------------------------------------

function getMockFreeholdsResult(): FreeholdsResult {
  const mockTitle: FreeholdsTitle = {
    titleNumber: 'MX368346',
    titleClass: 'Absolute freehold title',
    leaseholds: 6,
    distance: '0.00',
    lat: 51.541974,
    lng: -0.209526,
    polygonId: 18337541,
  }
  const mockDetail: TitleDetail = {
    titleNumber: 'MX368346',
    titleClass: 'Absolute freehold title',
    estateInterest: 'Estate in land',
    ownershipType: 'Corporate body',
    ownerName: 'BAMBOO COURT MANAGEMENT LTD',
    plotSizeAcres: '0.12',
    leaseholdTitleNumbers: ['MX411001', 'MX411002', 'MX411003', 'MX411004', 'MX411005', 'MX411006'],
    uprns: [100120825786, 100120825787],
  }
  return {
    inferredTenure: 'leasehold',
    nearestTitle: mockTitle,
    nearestTitleDetail: mockDetail,
    allTitles: [mockTitle],
    resultCount: 1,
    flags: buildFreeholdsFlags('leasehold', mockTitle, mockDetail),
  }
}
