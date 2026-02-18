/**
 * HM Land Registry — Price Paid Data (PPD) integration
 *
 * Downloads the annual PPD CSV (plain text, no zip) and imports a deduplicated
 * street→postcode mapping into the price_paid_addresses table.
 *
 * PPD CSV format (no header row, comma-separated):
 *  [0]  Transaction ID
 *  [1]  Price
 *  [2]  Date of Transfer
 *  [3]  Postcode
 *  [4]  Property Type (D/S/T/F/O)
 *  [5]  Old/New
 *  [6]  Duration (F/L)
 *  [7]  PAON (primary addressable object name – house number/name)
 *  [8]  SAON (secondary addressable object name)
 *  [9]  Street
 *  [10] Locality
 *  [11] Town/City
 *  [12] District
 *  [13] County
 *  [14] PPD Category Type
 *  [15] Record Status
 */

import { prisma } from "./db"
import { parse } from "csv-parse"
import { PassThrough } from "stream"

// ============================================================================
// Constants
// ============================================================================

// Base URL for the Land Registry open-data S3 bucket (no auth required)
const PPD_BASE_URL =
  "http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com"

const BATCH_SIZE = 500
const PROGRESS_EVERY_N_BATCHES = 10 // update DB every 5,000 rows

// ============================================================================
// In-memory cancel tracking (mirrors pattern from land-registry.ts)
// ============================================================================

const activePpdImports = new Map<string, { cancelled: boolean }>()

// ============================================================================
// Helpers
// ============================================================================

/** Normalise a street name for deduplication: lowercase, trim, collapse spaces */
function normalizeStreet(street: string): string {
  return street.toLowerCase().trim().replace(/\s+/g, " ")
}

/** Build the download URL for a given year, or the combined "full" file */
export function ppdDownloadUrl(year: number): string {
  if (year === 0) {
    // Complete dataset (all years) — very large (~5 GB)
    return `${PPD_BASE_URL}/pp-complete.csv`
  }
  return `${PPD_BASE_URL}/pp-${year}.csv`
}

// ============================================================================
// Import
// ============================================================================

/**
 * Downloads the PPD CSV for the given year (or 0 = all years) and upserts
 * a deduplicated set of (streetNorm, postcode) rows into price_paid_addresses.
 *
 * Supports cancellation via activePpdImports.
 */
export async function downloadAndImportPpd(
  year: number,
  importId: string
): Promise<void> {
  activePpdImports.set(importId, { cancelled: false })

  await prisma.pricePaidImport.update({
    where: { id: importId },
    data: { status: "RUNNING", startedAt: new Date() },
  })

  try {
    const url = ppdDownloadUrl(year)
    console.log(`[PPD] Starting download: ${url}`)

    const downloadRes = await fetch(url)
    if (!downloadRes.ok) {
      throw new Error(`PPD download failed: HTTP ${downloadRes.status} for ${url}`)
    }
    if (!downloadRes.body) {
      throw new Error("PPD download response has no body")
    }

    // Convert Web ReadableStream → Node PassThrough → csv-parse
    const nodeStream = new PassThrough()
    const reader = downloadRes.body.getReader()

    // Stream download in the background
    ;(async () => {
      try {
        while (true) {
          const state = activePpdImports.get(importId)
          if (state?.cancelled) {
            nodeStream.destroy(new Error("Import cancelled"))
            return
          }
          const { done, value } = await reader.read()
          if (done) {
            nodeStream.end()
            return
          }
          nodeStream.write(value)
        }
      } catch (e) {
        nodeStream.destroy(e as Error)
      }
    })()

    // PPD CSV has NO header row; parse with columns disabled
    const csvParser = parse({
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    })

    nodeStream.pipe(csvParser)

    let batch: Array<{ street: string; streetNorm: string; postcode: string; town: string | null }> = []
    // Dedup within each batch using a Set of "streetNorm|postcode" keys to avoid
    // sending thousands of identical rows to Postgres.
    const batchKeys = new Set<string>()

    let recordsRead = 0
    let recordsInserted = 0
    let batchCount = 0

    for await (const row of csvParser as AsyncIterable<string[]>) {
      const state = activePpdImports.get(importId)
      if (state?.cancelled) {
        throw new Error("Import cancelled by user")
      }

      recordsRead++

      const postcode = row[3]?.trim()
      const street = row[9]?.trim()
      const town = row[11]?.trim() || null

      // Skip rows without a full postcode or street name
      if (!postcode || !street || !/^[A-Z]{1,2}\d/.test(postcode.toUpperCase())) continue

      const streetNorm = normalizeStreet(street)
      const key = `${streetNorm}|${postcode.toUpperCase()}`
      if (batchKeys.has(key)) continue
      batchKeys.add(key)

      batch.push({ street, streetNorm, postcode: postcode.toUpperCase(), town })

      if (batch.length >= BATCH_SIZE) {
        const inserted = await flushPpdBatch(batch)
        recordsInserted += inserted
        batch = []
        batchKeys.clear()
        batchCount++

        if (batchCount % PROGRESS_EVERY_N_BATCHES === 0) {
          await prisma.pricePaidImport.update({
            where: { id: importId },
            data: { recordsRead, recordsInserted },
          })
          console.log(
            `[PPD] Progress: ${recordsRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted`
          )
        }
      }
    }

    // Flush remainder
    if (batch.length > 0) {
      const inserted = await flushPpdBatch(batch)
      recordsInserted += inserted
    }

    await prisma.pricePaidImport.update({
      where: { id: importId },
      data: {
        status: "COMPLETED",
        recordsRead,
        recordsInserted,
        completedAt: new Date(),
      },
    })

    activePpdImports.delete(importId)
    console.log(
      `[PPD] Import complete: ${recordsRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} unique street→postcode pairs inserted`
    )
  } catch (error: any) {
    activePpdImports.delete(importId)

    const state = activePpdImports.get(importId)
    const isCancelled = state?.cancelled || error.message === "Import cancelled by user"

    await prisma.pricePaidImport.update({
      where: { id: importId },
      data: {
        status: isCancelled ? "CANCELLED" : "FAILED",
        errorMessage: error.message,
        completedAt: isCancelled ? new Date() : undefined,
        cancelledAt: isCancelled ? new Date() : undefined,
      },
    })

    if (!isCancelled) throw error
  }
}

/** Upsert a batch, returns number of rows that were actually new */
async function flushPpdBatch(
  batch: Array<{ street: string; streetNorm: string; postcode: string; town: string | null }>
): Promise<number> {
  const result = await prisma.pricePaidAddress.createMany({
    data: batch,
    skipDuplicates: true,
  })
  return result.count
}

// ============================================================================
// Cancel
// ============================================================================

export async function cancelPpdImport(importId: string): Promise<void> {
  const record = await prisma.pricePaidImport.findUnique({
    where: { id: importId },
    select: { status: true },
  })
  if (!record || !["RUNNING", "PENDING"].includes(record.status)) {
    throw new Error("Import is not running")
  }

  const active = activePpdImports.get(importId)
  if (active) active.cancelled = true

  await prisma.pricePaidImport.update({
    where: { id: importId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })

  activePpdImports.delete(importId)
}

// ============================================================================
// Postcode lookup
// ============================================================================

/**
 * Look up a postcode for a given street name using the imported PPD data.
 *
 * PPD stores street names WITHOUT house numbers (e.g. "HIGH STREET", not "23 High Street").
 * We try progressively looser matches:
 *   1. Exact normalised street name
 *   2. PPD row contains the normalised street name (PPD is longer)
 *   3. Strip leading house-number token(s) from the input and retry 1+2
 *   4. Town-based fallback (no outcode required) — for addresses like "Penlan Crescent, Swansea"
 *
 * @param streetName   First comma-segment of the address (may include house number)
 * @param outcode      Outward code e.g. "SA6", or empty string for town-only lookup
 * @param town         Optional: last meaningful town/city segment of the address
 * @returns Full postcode string or null if not found
 */
export async function lookupPostcodeFromPpd(
  streetName: string,
  outcode: string,
  town?: string | null
): Promise<string | null> {
  if (!streetName) return null

  const norm = normalizeStreet(streetName)
  if (norm.length < 3) return null

  // Pre-compute stripped variants to remove leading house numbers
  // e.g. "23 high street" → "high street"
  //      "flat 3 elm road" → "elm road"
  const tokens = norm.split(" ")
  const stripped1 = tokens.slice(1).join(" ") // drop first token
  const stripped2 = tokens.slice(2).join(" ") // drop first two tokens

  const outcodeFilter = outcode ? { startsWith: outcode + " " } : undefined

  // Helper — try exact then "PPD contains" for a given candidate
  async function tryMatch(candidate: string): Promise<string | null> {
    if (candidate.length < 3) return null

    // 1. Exact
    const exact = await prisma.pricePaidAddress.findFirst({
      where: {
        streetNorm: candidate,
        ...(outcodeFilter ? { postcode: outcodeFilter } : {}),
        ...(town && !outcode ? { town: { contains: town, mode: "insensitive" as const } } : {}),
      },
      select: { postcode: true },
    })
    if (exact) return exact.postcode

    // 2. PPD row streetNorm contains our candidate
    //    (handles our input being a substring of a longer PPD street name)
    const contains = await prisma.pricePaidAddress.findFirst({
      where: {
        streetNorm: { contains: candidate },
        ...(outcodeFilter ? { postcode: outcodeFilter } : {}),
        ...(town && !outcode ? { town: { contains: town, mode: "insensitive" as const } } : {}),
      },
      select: { postcode: true },
    })
    return contains?.postcode ?? null
  }

  // Try the full normalised name first
  let result = await tryMatch(norm)
  if (result) return result

  // Strip leading house number and retry
  if (stripped1.length >= 3) {
    result = await tryMatch(stripped1)
    if (result) return result
  }

  // Strip two leading tokens (e.g. "flat 3 elm road" → "elm road")
  if (stripped2.length >= 3) {
    result = await tryMatch(stripped2)
    if (result) return result
  }

  // Town-only fallback (when no outcode given): try town match alone so we
  // at least get a representative postcode for the street in that town
  if (town && !outcode) {
    const townOnly = await prisma.pricePaidAddress.findFirst({
      where: {
        streetNorm: { contains: norm.length >= 3 ? norm : stripped1 },
        town: { contains: town, mode: "insensitive" },
      },
      select: { postcode: true },
    })
    if (townOnly) return townOnly.postcode
  }

  return null
}

// ============================================================================
// Stats
// ============================================================================

export async function getPpdStats(): Promise<{
  addressCount: number
  lastImport: { year: number; completedAt: Date | null; recordsInserted: number } | null
}> {
  const [addressCount, lastImport] = await Promise.all([
    prisma.pricePaidAddress.count(),
    prisma.pricePaidImport.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { year: true, completedAt: true, recordsInserted: true },
    }),
  ])

  return {
    addressCount,
    lastImport: lastImport
      ? {
          year: lastImport.year,
          completedAt: lastImport.completedAt,
          recordsInserted: lastImport.recordsInserted,
        }
      : null,
  }
}
