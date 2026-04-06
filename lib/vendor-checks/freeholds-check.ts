/**
 * Freeholds Check
 * Calls PropertyData /freeholds endpoint to return freehold land title numbers
 * at the property's postcode, with leasehold counts per polygon.
 *
 * Infers tenure (freehold vs leasehold) from the nearest polygon's leasehold count.
 * Generates a caution flag when a unit is likely leasehold with no years data.
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

export interface FreeholdsResult {
  inferredTenure: 'freehold' | 'leasehold' | 'unknown'
  nearestTitle: FreeholdsTitle | null
  allTitles: FreeholdsTitle[]
  resultCount: number
  flags: PortalFlag[]
}

// ---------------------------------------------------------------------------
// API response shape
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
    return { inferredTenure: 'unknown', nearestTitle: null, allTitles: [], resultCount: 0, flags: [] }
  }

  if (isMock) {
    return getMockFreeholdsResult()
  }

  const apiKey = process.env.PROPERTYDATA_API_KEY
  if (!apiKey) {
    console.warn('[FreeholdsCheck] PROPERTYDATA_API_KEY not set — skipping freeholds check')
    return { inferredTenure: 'unknown', nearestTitle: null, allTitles: [], resultCount: 0, flags: [] }
  }

  try {
    const url = `https://api.propertydata.co.uk/freeholds?key=${apiKey}&postcode=${encodeURIComponent(postcode)}&results=10`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`PropertyData /freeholds HTTP ${res.status}`)
    const json: PropertyDataFreeholdsResponse = await res.json()

    if (json.status !== 'success' || !json.data?.length) {
      return { inferredTenure: 'unknown', nearestTitle: null, allTitles: [], resultCount: 0, flags: [] }
    }

    // Flatten polygons into a list of titles sorted by distance ascending
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

    // Infer tenure:
    // - Nearest polygon has leaseholds > 0  → the building has sub-leases → unit is likely leasehold
    // - Nearest polygon has leaseholds === 0 → it's a freehold house (no sub-leases)
    const inferredTenure: FreeholdsResult['inferredTenure'] =
      nearest == null
        ? 'unknown'
        : nearest.leaseholds > 0
        ? 'leasehold'
        : 'freehold'

    const flags: PortalFlag[] = buildFreeholdsFlags(inferredTenure, nearest)

    return {
      inferredTenure,
      nearestTitle: nearest,
      allTitles,
      resultCount: json.result_count ?? allTitles.length,
      flags,
    }
  } catch (err: any) {
    console.error('[FreeholdsCheck] Error:', err?.message)
    return { inferredTenure: 'unknown', nearestTitle: null, allTitles: [], resultCount: 0, flags: [] }
  }
}

// ---------------------------------------------------------------------------
// Flag builder
// ---------------------------------------------------------------------------

function buildFreeholdsFlags(
  tenure: FreeholdsResult['inferredTenure'],
  nearest: FreeholdsTitle | null
): PortalFlag[] {
  const flags: PortalFlag[] = []

  if (tenure === 'leasehold') {
    const count = nearest?.leaseholds ?? 0
    flags.push({
      code: 'LIKELY_LEASEHOLD',
      severity: 'caution',
      label: 'Likely Leasehold Property',
      detail: `Nearest freehold title (${nearest?.titleNumber ?? 'unknown'}) has ${count} leasehold${count !== 1 ? 's' : ''} — confirm lease terms before proceeding. Short leases (<80yr) significantly impact mortgage-ability and value.`,
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
  return {
    inferredTenure: 'leasehold',
    nearestTitle: mockTitle,
    allTitles: [mockTitle],
    resultCount: 1,
    flags: buildFreeholdsFlags('leasehold', mockTitle),
  }
}
