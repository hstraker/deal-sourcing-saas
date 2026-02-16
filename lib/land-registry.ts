/**
 * HM Land Registry — "Use Land and Property Data" integration
 *
 * Handles:
 *  - Downloading and importing CCOD/OCOD datasets (bulk CSV in ZIP)
 *  - Postcode-based ownership lookups against the imported data
 *  - Auto-enrichment of PropertyListing.bmvIndicators with ownership intelligence
 */

import { prisma } from "./db"
import { parse } from "csv-parse"
import * as unzipper from "unzipper"
import { PassThrough } from "stream"

const API_BASE = "https://use-land-property-data.service.gov.uk/api/v1"

// ============================================================================
// Types
// ============================================================================

export interface BmvOwnershipIntel {
  isCorporateOwned: boolean
  isOverseasOwned: boolean
  isPortfolioOwner: boolean // company owns 5+ records in our DB (portfolio seller)
  proprietorCategory: string | null
  companyName: string | null
  companyRegNumber: string | null
}

// ============================================================================
// Postcode helpers
// ============================================================================

/** Uppercase + strip all spaces: "N1 1AA" → "N11AA" */
export function normalizePostcode(postcode: string): string {
  return postcode.toUpperCase().replace(/\s+/g, "")
}

/** Extract the outward code (first segment): "N11AA" → "N1" */
function outwardCode(normalized: string): string {
  // UK outward code is everything before the last 3 characters (digit + 2 letters)
  return normalized.slice(0, normalized.length - 3)
}

/** Try to extract a UK postcode from a full address string */
function extractPostcodeFromAddress(address: string): string | null {
  const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})/i)
  return match ? match[1].trim() : null
}

// ============================================================================
// Dataset metadata
// ============================================================================

async function fetchDatasetDownloadUrl(
  datasetType: "ccod" | "ocod"
): Promise<string> {
  const apiKey = process.env.LAND_REGISTRY_API_KEY
  if (!apiKey) throw new Error("LAND_REGISTRY_API_KEY is not set")

  const res = await fetch(`${API_BASE}/datasets/${datasetType}`, {
    headers: { Authorization: apiKey },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Land Registry API error ${res.status} for ${datasetType}: ${body}`
    )
  }

  const data = await res.json()
  console.log(
    `[LandRegistry] ${datasetType.toUpperCase()} metadata (truncated):`,
    JSON.stringify(data).slice(0, 800)
  )

  // Normalise resource list from various nesting patterns
  const resourceList: Record<string, unknown>[] =
    data?.result?.resources ??
    data?.resources ??
    (Array.isArray(data?.result) ? data.result : null) ??
    []

  if (resourceList.length === 0) {
    throw new Error(
      `No resources found for ${datasetType}. Top-level keys: ${Object.keys(data ?? {}).join(", ")}`
    )
  }

  // Prefer a "full" / "complete" file over change-only files
  const sorted = [...resourceList].sort((a, b) => {
    const aName = String(a.file_name ?? a.name ?? "").toLowerCase()
    const bName = String(b.file_name ?? b.name ?? "").toLowerCase()
    const aFull = aName.includes("full") || aName.includes("complete") ? -1 : 1
    const bFull = bName.includes("full") || bName.includes("complete") ? -1 : 1
    return aFull - bFull
  })

  const resource = sorted[0]

  // 1. Try any explicit URL fields in the resource object
  for (const key of ["file_url", "url", "download_url", "fileUrl", "downloadUrl", "href", "link"]) {
    const val = resource[key]
    if (typeof val === "string" && val.startsWith("http")) return val
  }

  // 2. Construct URL from file_name — the standard HMLR pattern:
  //    GET /api/v1/datasets/{dataset}/{file_name}
  const fileName = resource.file_name ?? resource.name
  if (typeof fileName === "string" && fileName) {
    const constructed = `${API_BASE}/datasets/${datasetType}/${encodeURIComponent(fileName)}`
    console.log(`[LandRegistry] Constructed download URL: ${constructed}`)
    return constructed
  }

  throw new Error(
    `Could not determine download URL for ${datasetType}. ` +
      `Resource keys: ${Object.keys(resource).join(", ")} | ` +
      `Values: ${JSON.stringify(resource).slice(0, 200)}`
  )
}

// ============================================================================
// CSV column mappings
// ============================================================================

// CCOD columns (UK companies)
const CCOD_COLUMNS: Record<string, string> = {
  "Title Number": "titleNumber",
  Tenure: "tenure",
  "Property Address": "propertyAddress",
  "Company Name (1)": "companyName",
  "Company Registration No. (1)": "companyRegNumber",
  "Proprietor (1) Address (1)": "companyAddress",
  "Proprietor Category (1)": "proprietorCategory",
  "Date Proprietor Added": "dateProprietary",
  "Price Paid": "pricePaid",
}

// OCOD columns (overseas companies — slightly different headers)
const OCOD_COLUMNS: Record<string, string> = {
  "Title Number": "titleNumber",
  Tenure: "tenure",
  "Property Address": "propertyAddress",
  "Proprietor Name (1)": "companyName",
  "Company Registration No. (1)": "companyRegNumber",
  "Proprietor (1) Address (1)": "companyAddress",
  "Proprietor Category (1)": "proprietorCategory",
  "Country Incorporated (1)": "countryIncorporated",
  "Date Proprietor Added": "dateProprietary",
  "Price Paid": "pricePaid",
}

// ============================================================================
// Import service
// ============================================================================

type OwnershipCreateInput = {
  titleNumber: string
  tenure: string | null
  propertyAddress: string
  postcode: string | null
  postcodeNormalized: string | null
  companyName: string
  companyRegNumber: string | null
  companyAddress: string | null
  proprietorCategory: string | null
  countryIncorporated: string | null
  isOverseas: boolean
  dateProprietary: string | null
  pricePaid: string | null // pass as string so Prisma's Decimal parser handles it safely
}

function mapCsvRow(
  row: Record<string, string>,
  columnMap: Record<string, string>,
  isOverseas: boolean
): OwnershipCreateInput | null {
  const mapped: Record<string, string | null> = {}
  for (const [csvCol, fieldName] of Object.entries(columnMap)) {
    mapped[fieldName] = row[csvCol] ?? null
  }

  const titleNumber = mapped.titleNumber?.trim()
  if (!titleNumber) return null

  const propertyAddress = mapped.propertyAddress?.trim() ?? ""
  const rawPostcode = extractPostcodeFromAddress(propertyAddress) ?? null
  const postcodeNormalized = rawPostcode ? normalizePostcode(rawPostcode) : null

  // Convert price to a clean decimal string for Prisma (or null)
  let pricePaid: string | null = null
  if (mapped.pricePaid) {
    const cleaned = mapped.pricePaid.replace(/[£,\s]/g, "")
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed) && parsed > 0) pricePaid = parsed.toFixed(2)
  }

  return {
    titleNumber,
    tenure: mapped.tenure?.trim() || null,
    propertyAddress,
    postcode: rawPostcode,
    postcodeNormalized,
    companyName: mapped.companyName?.trim() || "Unknown",
    companyRegNumber: mapped.companyRegNumber?.trim() || null,
    companyAddress: mapped.companyAddress?.trim() || null,
    proprietorCategory: mapped.proprietorCategory?.trim() || null,
    countryIncorporated: mapped.countryIncorporated?.trim() || null,
    isOverseas,
    dateProprietary: mapped.dateProprietary?.trim() || null,
    pricePaid,
  }
}

// Global map to track active imports and allow cancellation
const activeImports = new Map<string, { cancelled: boolean; paused: boolean }>()

/**
 * Check if import should be paused, cancelled, or resumed
 */
async function checkImportStatus(importId: string): Promise<"continue" | "pause" | "cancel"> {
  const importRecord = await prisma.landRegistryImport.findUnique({
    where: { id: importId },
    select: { status: true },
  })

  if (!importRecord) return "cancel"

  const active = activeImports.get(importId)
  if (active?.cancelled || importRecord.status === "CANCELLED") {
    return "cancel"
  }
  if (active?.paused || importRecord.status === "PAUSED") {
    return "pause"
  }
  if (importRecord.status !== "RUNNING") {
    return "cancel"
  }

  return "continue"
}

/**
 * Downloads the latest CCOD or OCOD dataset ZIP, streams+parses the CSV inside,
 * and batch-inserts records into the company_ownership table.
 * Supports pause, resume, and cancellation.
 */
export async function downloadAndImportDataset(
  datasetType: "ccod" | "ocod",
  importId: string
): Promise<void> {
  const isOverseas = datasetType === "ocod"
  const columnMap = isOverseas ? OCOD_COLUMNS : CCOD_COLUMNS

  // Initialize active import tracking
  activeImports.set(importId, { cancelled: false, paused: false })

  // Check if resuming
  const existing = await prisma.landRegistryImport.findUnique({
    where: { id: importId },
  })

  const isResuming = existing?.status === "PAUSED" && existing.recordsImported > 0

  await prisma.landRegistryImport.update({
    where: { id: importId },
    data: {
      status: "RUNNING",
      startedAt: existing?.startedAt ?? new Date(),
      resumedAt: isResuming ? new Date() : undefined,
    },
  })

  try {
    // 1. Resolve the file name from the dataset metadata
    const fileUrl = await fetchDatasetDownloadUrl(datasetType)
    console.log(`[LandRegistry] File URL: ${fileUrl}`)

    // 2. The HMLR API uses a two-step download pattern
    const apiKey = process.env.LAND_REGISTRY_API_KEY!
    const fileMetaRes = await fetch(fileUrl, {
      headers: { Authorization: apiKey },
      redirect: "manual",
    })

    let actualDownloadUrl: string = fileUrl

    if (fileMetaRes.status === 301 || fileMetaRes.status === 302 || fileMetaRes.status === 307 || fileMetaRes.status === 308) {
      actualDownloadUrl = fileMetaRes.headers.get("location") ?? fileUrl
      console.log(`[LandRegistry] Redirect to: ${actualDownloadUrl}`)
    } else if (fileMetaRes.ok) {
      const contentType = fileMetaRes.headers.get("content-type") ?? ""
      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        const body = await fileMetaRes.json()
        console.log(`[LandRegistry] File meta response:`, JSON.stringify(body).slice(0, 400))
        const signedUrl =
          body?.result?.download_url ??
          body?.result?.url ??
          body?.download_url ??
          body?.url ??
          body?.href ??
          body?.link
        if (typeof signedUrl === "string" && signedUrl.startsWith("http")) {
          actualDownloadUrl = signedUrl
          console.log(`[LandRegistry] Signed download URL: ${actualDownloadUrl}`)
        }
      }
    } else {
      throw new Error(`File metadata request failed: HTTP ${fileMetaRes.status}`)
    }

    // Get file size if available (before starting download)
    const headRes = await fetch(actualDownloadUrl, {
      method: "HEAD",
      headers: actualDownloadUrl !== fileUrl ? {} : { Authorization: apiKey },
    })
    const contentLength = headRes.headers.get("content-length")
    const bytesTotal = contentLength ? BigInt(contentLength) : null

    // Initialize progress tracking BEFORE starting download
    await prisma.landRegistryImport.update({
      where: { id: importId },
      data: {
        bytesTotal: bytesTotal?.toString() ?? null,
        bytesDownloaded: "0", // Explicitly set to 0, not null
        downloadSpeed: null,
        estimatedTimeRemaining: null,
      },
    })

    // 3. Stream-download the actual file
    const downloadRes = await fetch(actualDownloadUrl, {
      headers: actualDownloadUrl !== fileUrl ? {} : { Authorization: apiKey },
    })
    if (!downloadRes.ok) {
      throw new Error(`Download failed: HTTP ${downloadRes.status}`)
    }
    if (!downloadRes.body) {
      throw new Error("Download response has no body")
    }

    // Convert the Web ReadableStream → Node.js Readable → unzipper → csv-parse
    const nodeStream = new PassThrough()
    const reader = downloadRes.body.getReader()

    // Track download progress - always start from 0 for new downloads
    // Only use existing bytesDownloaded if resuming a paused import
    let bytesDownloaded =
      isResuming && existing?.bytesDownloaded
        ? BigInt(existing.bytesDownloaded)
        : BigInt(0)
    let lastProgressUpdate = Date.now()
    let bytesSinceLastUpdate = BigInt(0)
    const progressUpdateInterval = 2000 // Update every 2 seconds

    // Stream download with progress tracking
    ;(async () => {
      try {
        while (true) {
          const status = await checkImportStatus(importId)
          if (status === "cancel") {
            nodeStream.destroy(new Error("Import cancelled"))
            break
          }
          if (status === "pause") {
            // Pause: stop reading but don't destroy stream
            await new Promise((resolve) => {
              const checkPause = setInterval(async () => {
                const s = await checkImportStatus(importId)
                if (s !== "pause") {
                  clearInterval(checkPause)
                  resolve(undefined)
                }
              }, 1000)
            })
            continue
          }

          const { done, value } = await reader.read()
          if (done) {
            nodeStream.end()
            break
          }

          bytesDownloaded += BigInt(value.length)
          bytesSinceLastUpdate += BigInt(value.length)
          nodeStream.write(value)

          // Update progress every interval
          const now = Date.now()
          if (now - lastProgressUpdate >= progressUpdateInterval) {
            const elapsed = (now - lastProgressUpdate) / 1000
            const speed = Number(bytesSinceLastUpdate) / elapsed
            const remaining = bytesTotal ? Number(bytesTotal - bytesDownloaded) / speed : 0

            await prisma.landRegistryImport.update({
              where: { id: importId },
              data: {
                bytesDownloaded: bytesDownloaded.toString(),
                downloadSpeed: speed,
                estimatedTimeRemaining: remaining > 0 ? Math.round(remaining) : null,
              },
            })

            lastProgressUpdate = now
            bytesSinceLastUpdate = BigInt(0)
          }
        }
      } catch (e) {
        nodeStream.destroy(e as Error)
      }
    })()

    // Pipe through unzipper then csv-parse
    const csvParser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    })

    nodeStream.pipe(unzipper.ParseOne(/\.csv$/i)).pipe(csvParser)

    const BATCH_SIZE = 500
    let batch: OwnershipCreateInput[] = []
    let importedCount = existing?.recordsImported ?? 0
    let recordCount = existing?.recordsTotal ?? 0
    let progressUpdateCount = 0
    const startTime = Date.now()

    for await (const row of csvParser as AsyncIterable<Record<string, string>>) {
      recordCount++
      const mapped = mapCsvRow(row, columnMap, isOverseas)
      if (!mapped) continue

      batch.push(mapped)

      if (batch.length >= BATCH_SIZE) {
        // Check pause/cancel once per batch (500 rows) instead of per-row.
        // Checking on every row causes millions of DB queries for large datasets
        // (CCOD has 3-5M records) which hammers the connection pool.
        const status = await checkImportStatus(importId)
        if (status === "cancel") {
          throw new Error("Import cancelled by user")
        }
        if (status === "pause") {
          // Save current state and pause
          await prisma.landRegistryImport.update({
            where: { id: importId },
            data: {
              status: "PAUSED",
              pausedAt: new Date(),
              recordsImported: importedCount,
              recordsTotal: recordCount,
              bytesDownloaded: bytesDownloaded.toString(),
            },
          })
          activeImports.delete(importId)
          return // Exit, can be resumed later
        }

        const toFlush = batch.splice(0, BATCH_SIZE)
        await flushBatch(toFlush)
        importedCount += toFlush.length
        progressUpdateCount++

        // Update DB progress every 5 batches (2,500 records) for better responsiveness
        if (progressUpdateCount % 5 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const recordsPerSecond = importedCount / elapsed
          const remaining = recordCount > 0 ? recordCount - importedCount : 0
          const eta = remaining > 0 && recordsPerSecond > 0 ? Math.round(remaining / recordsPerSecond) : null

          await prisma.landRegistryImport.update({
            where: { id: importId },
            data: {
              recordsImported: importedCount,
              recordsTotal: recordCount,
              estimatedTimeRemaining: eta,
            },
          })
          console.log(
            `[LandRegistry] ${datasetType.toUpperCase()} progress: ${importedCount.toLocaleString()}/${recordCount.toLocaleString()} (${Math.round((importedCount / recordCount) * 100)}%)`
          )
        }
      }
    }

    // Flush remaining records
    if (batch.length > 0) {
      await flushBatch(batch)
      importedCount += batch.length
    }

    await prisma.landRegistryImport.update({
      where: { id: importId },
      data: {
        status: "COMPLETED",
        recordsImported: importedCount,
        recordsTotal: recordCount,
        completedAt: new Date(),
        bytesDownloaded: bytesDownloaded.toString(),
      },
    })

    activeImports.delete(importId)

    console.log(
      `[LandRegistry] Import complete: ${importedCount.toLocaleString()} records from ${datasetType.toUpperCase()}`
    )
  } catch (error: any) {
    activeImports.delete(importId)
    console.error(`[LandRegistry] Import failed for ${datasetType}:`, error)

    const status = await checkImportStatus(importId)
    const finalStatus = status === "cancel" ? "CANCELLED" : "FAILED"

    await prisma.landRegistryImport.update({
      where: { id: importId },
      data: {
        status: finalStatus,
        errorMessage: error.message,
        completedAt: finalStatus === "CANCELLED" ? new Date() : undefined,
        cancelledAt: finalStatus === "CANCELLED" ? new Date() : undefined,
      },
    })
    throw error
  }
}

/**
 * Pause an active import
 */
export async function pauseImport(importId: string): Promise<void> {
  const importRecord = await prisma.landRegistryImport.findUnique({
    where: { id: importId },
  })

  if (!importRecord || importRecord.status !== "RUNNING") {
    throw new Error("Import is not running")
  }

  const active = activeImports.get(importId)
  if (active) {
    active.paused = true
  }

  await prisma.landRegistryImport.update({
    where: { id: importId },
    data: {
      status: "PAUSED",
      pausedAt: new Date(),
    },
  })
}

/**
 * Resume a paused import
 */
export async function resumeImport(importId: string): Promise<void> {
  const importRecord = await prisma.landRegistryImport.findUnique({
    where: { id: importId },
  })

  if (!importRecord || importRecord.status !== "PAUSED") {
    throw new Error("Import is not paused")
  }

  // Reset paused flag and restart the import process
  activeImports.set(importId, { cancelled: false, paused: false })

  await prisma.landRegistryImport.update({
    where: { id: importId },
    data: {
      status: "PENDING",
      resumedAt: new Date(),
    },
  })

  // Restart the import process
  const datasetType = importRecord.datasetType.toLowerCase() as "ccod" | "ocod"
  downloadAndImportDataset(datasetType, importId).catch((e) => {
    console.error(`[LandRegistry] Resume failed for ${importId}:`, e)
  })
}

/**
 * Cancel an active or paused import
 */
export async function cancelImport(importId: string): Promise<void> {
  const importRecord = await prisma.landRegistryImport.findUnique({
    where: { id: importId },
  })

  if (!importRecord || (importRecord.status !== "RUNNING" && importRecord.status !== "PAUSED")) {
    throw new Error("Import cannot be cancelled")
  }

  const active = activeImports.get(importId)
  if (active) {
    active.cancelled = true
  }

  await prisma.landRegistryImport.update({
    where: { id: importId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  })

  activeImports.delete(importId)
}

/** Insert a batch of ownership records, skipping existing titleNumbers */
async function flushBatch(batch: OwnershipCreateInput[]): Promise<void> {
  await prisma.companyOwnership.createMany({
    data: batch as any,
    skipDuplicates: true,
  })
}

// ============================================================================
// Postcode resolution
// ============================================================================

/** Full UK postcode: e.g. "SA6 8DU" */
const FULL_PC_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2})\b/i
/** UK outcode only: e.g. "SA6", "SW1A" */
const OUTCODE_ONLY_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/gi

/**
 * Resolve or correct a postcode using the property's display address.
 *
 * Scrapers (particularly Zoopla) sometimes embed the wrong postcode — e.g.
 * Zoopla's own London office postcode SE1 2LH appears in the page footer and
 * gets picked up before the actual property area postcode.
 *
 * Resolution order:
 *  1. If the stored postcode is a valid full UK postcode whose outcode matches
 *     the outcode embedded in the display address → return it as-is (no change)
 *  2. Search Land Registry companyOwnership by street name + outcode
 *  3. Fall back to postcodes.io free API for a representative postcode in that outcode
 *
 * Returns null only if we have no address outcode to work from at all.
 */
export async function resolvePostcodeFromAddress(
  displayAddress: string | null,
  storedPostcode: string | null,
  /** Optional caller-managed cache: outcode → resolved full postcode (or null = tried, no result) */
  outcodeCache?: Map<string, string | null>
): Promise<{
  postcode: string
  source: "stored" | "land_registry" | "postcodes_io"
  corrected: boolean
} | null> {
  if (!displayAddress) return null

  // Extract all outcode candidates from the display address
  // (the property outcode usually appears near the end, e.g. "Swansea SA6")
  const outcodeMatches = [...displayAddress.matchAll(OUTCODE_ONLY_RE)]
  // Filter out obvious non-postcodes (single chars, numbers-only, etc.)
  const candidates = outcodeMatches
    .map((m) => m[1].toUpperCase())
    .filter((s) => /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(s) && s.length >= 2)
  // Take last match — outcode typically appears at the end of the address
  const outcode = candidates.length > 0 ? candidates[candidates.length - 1] : null

  if (!outcode) {
    // No outcode found in address — just validate the stored postcode format
    if (storedPostcode && FULL_PC_RE.test(storedPostcode.trim())) {
      return { postcode: storedPostcode.trim().toUpperCase().replace(/\s+/g, " "), source: "stored", corrected: false }
    }
    return null
  }

  // Validate stored postcode against the outcode we found in the address
  const storedTrimmed = storedPostcode?.trim().toUpperCase().replace(/\s+/g, " ") ?? ""
  const storedIsFull = FULL_PC_RE.test(storedTrimmed)
  const storedOutcode = storedIsFull ? storedTrimmed.split(" ")[0] : ""
  const storedMatchesArea = storedIsFull && storedOutcode === outcode

  if (storedMatchesArea) {
    // Stored postcode is a full postcode and its outcode matches the address — it's correct
    return { postcode: storedTrimmed, source: "stored", corrected: false }
  }

  // Stored postcode is absent, outcode-only, or belongs to the wrong area.
  console.log(
    `[LandRegistry] Postcode "${storedPostcode}" doesn't match address outcode "${outcode}" ` +
    `in "${displayAddress.substring(0, 70)}" — attempting resolution`
  )

  // Step 1: Land Registry companyOwnership — search by street name + outcode
  const hasData = await prisma.companyOwnership.findFirst({ select: { id: true } })
  if (hasData) {
    const streetName = displayAddress.split(",")[0].trim()
    if (streetName.length > 3) {
      const lrRecord = await prisma.companyOwnership.findFirst({
        where: {
          AND: [
            { propertyAddress: { contains: streetName, mode: "insensitive" } },
            { postcode: { startsWith: outcode + " " } },
          ],
        },
        select: { postcode: true },
      })
      if (lrRecord?.postcode) {
        const resolved = lrRecord.postcode.trim().toUpperCase().replace(/\s+/g, " ")
        console.log(`[LandRegistry] Resolved postcode "${resolved}" for "${streetName}" via Land Registry data`)
        return { postcode: resolved, source: "land_registry", corrected: true }
      }
    }

    // Step 1b: No street-name match — get a representative postcode for the outcode
    // from any Land Registry record. This covers virtually all UK outcodes and avoids
    // relying on the external postcodes.io API for bulk operations.
    if (outcodeCache?.has(outcode)) {
      const cached = outcodeCache.get(outcode)
      if (cached) {
        return { postcode: cached, source: "land_registry", corrected: true }
      }
    } else {
      const repRecord = await prisma.companyOwnership.findFirst({
        where: { postcode: { startsWith: outcode + " " } },
        select: { postcode: true },
      })
      if (repRecord?.postcode) {
        const resolved = repRecord.postcode.trim().toUpperCase().replace(/\s+/g, " ")
        console.log(`[LandRegistry] Resolved representative postcode "${resolved}" for outcode "${outcode}" via Land Registry`)
        outcodeCache?.set(outcode, resolved)
        return { postcode: resolved, source: "land_registry", corrected: true }
      }
      outcodeCache?.set(outcode, null) // outcode not in LR data
    }
  }

  // Step 2: postcodes.io free API — fallback for outcodes not in Land Registry data
  // Check caller-provided cache first to avoid redundant API calls for the same outcode
  if (outcodeCache?.has(outcode)) {
    const cached = outcodeCache.get(outcode)
    if (cached) {
      return { postcode: cached, source: "postcodes_io", corrected: true }
    }
    // null in cache means we already tried and got nothing — skip the API call
  } else {
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes?q=${encodeURIComponent(outcode)}&limit=1`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const body = (await res.json()) as { result?: Array<{ postcode: string }> }
        const first = body?.result?.[0]?.postcode
        if (first) {
          console.log(`[LandRegistry] Resolved postcode "${first}" for outcode "${outcode}" via postcodes.io`)
          outcodeCache?.set(outcode, first)
          return { postcode: first, source: "postcodes_io", corrected: true }
        }
        outcodeCache?.set(outcode, null) // cache miss
      } else {
        outcodeCache?.set(outcode, null) // cache non-ok response
      }
    } catch (err) {
      console.warn(`[LandRegistry] postcodes.io lookup failed for outcode "${outcode}":`, err)
      outcodeCache?.set(outcode, null) // cache failure so we don't retry
    }
  }

  // Could not resolve — if stored postcode is at least a valid full postcode, use it as fallback
  if (storedIsFull) {
    console.warn(`[LandRegistry] Could not resolve better postcode — keeping stored "${storedTrimmed}" despite area mismatch`)
    return { postcode: storedTrimmed, source: "stored", corrected: false }
  }

  return null
}

// ============================================================================
// Ownership lookup
// ============================================================================

/**
 * Find all ownership records for a given postcode.
 * First tries exact postcode match; if none, falls back to outward code match.
 */
export async function findOwnershipByPostcode(
  postcode: string
): Promise<{ isCorporateOwned: boolean; isOverseasOwned: boolean; isPortfolioOwner: boolean; proprietorCategory: string | null; companyName: string | null; companyRegNumber: string | null } | null> {
  const normalized = normalizePostcode(postcode)

  const matches = await prisma.companyOwnership.findMany({
    where: { postcodeNormalized: normalized },
    select: {
      companyName: true,
      companyRegNumber: true,
      proprietorCategory: true,
      isOverseas: true,
    },
    take: 20,
  })

  if (matches.length === 0) {
    // Try outward code only (e.g. "N1" from "N11AA")
    const outward = outwardCode(normalized)
    if (outward.length < 2) return null

    const fuzzyMatches = await prisma.companyOwnership.findMany({
      where: {
        postcodeNormalized: {
          startsWith: outward,
        },
      },
      select: {
        companyName: true,
        companyRegNumber: true,
        proprietorCategory: true,
        isOverseas: true,
      },
      take: 5,
    })

    if (fuzzyMatches.length === 0) return null

    return deriveIntel(fuzzyMatches)
  }

  return deriveIntel(matches)
}

type OwnershipRow = {
  companyName: string
  companyRegNumber: string | null
  proprietorCategory: string | null
  isOverseas: boolean
}

async function deriveIntel(
  matches: OwnershipRow[]
): Promise<BmvOwnershipIntel> {
  const first = matches[0]
  const isOverseas = matches.some((m) => m.isOverseas)

  // Determine if portfolio owner: company reg number owns 5+ entries in our DB
  let isPortfolioOwner = false
  if (first.companyRegNumber) {
    const count = await prisma.companyOwnership.count({
      where: { companyRegNumber: first.companyRegNumber },
    })
    isPortfolioOwner = count >= 5
  }

  return {
    isCorporateOwned: true,
    isOverseasOwned: isOverseas,
    isPortfolioOwner,
    proprietorCategory: first.proprietorCategory,
    companyName: first.companyName,
    companyRegNumber: first.companyRegNumber,
  }
}

// ============================================================================
// Property enrichment
// ============================================================================

/**
 * Looks up ownership for a PropertyListing by postcode and merges the intel
 * into its bmvIndicators JSON field, recalculating the bmvScore.
 * Fire-and-forget safe — errors are swallowed after logging.
 */
export async function enrichPropertyWithOwnership(
  listingId: string,
  postcode: string
): Promise<void> {
  // Skip quickly if no ownership data has been imported yet
  const hasData = await prisma.companyOwnership.findFirst({ select: { id: true } })
  if (!hasData) return

  const intel = await findOwnershipByPostcode(postcode)
  if (!intel) return

  // Fetch current bmvIndicators
  const listing = await prisma.propertyListing.findUnique({
    where: { id: listingId },
    select: { bmvIndicators: true },
  })
  if (!listing) return

  const existing = (listing.bmvIndicators as Record<string, unknown>) ?? {}

  // Merge ownership fields
  const updated = {
    ...existing,
    isCorporateOwned: intel.isCorporateOwned,
    isOverseasOwned: intel.isOverseasOwned,
    isPortfolioOwner: intel.isPortfolioOwner,
    proprietorType: intel.proprietorCategory,
    ownerCompanyName: intel.companyName,
    // Recalculate bmvScore with ownership bonuses
    bmvScore: recalculateBmvScoreWithOwnership(
      (existing.bmvScore as number) ?? 0,
      intel
    ),
  }

  await prisma.propertyListing.update({
    where: { id: listingId },
    data: { bmvIndicators: updated },
  })
}

/**
 * Adds ownership bonuses to an existing bmvScore (capped at 100).
 * Called when enriching after scrape — preserves all existing keyword-based scoring.
 */
function recalculateBmvScoreWithOwnership(
  baseScore: number,
  intel: BmvOwnershipIntel
): number {
  let bonus = 0
  if (intel.isCorporateOwned) bonus += 10 // corporate owner → easier negotiation
  if (intel.isOverseasOwned) bonus += 7   // overseas owner → potentially motivated
  if (intel.isPortfolioOwner) bonus += 5  // portfolio seller → bulk deal potential
  return Math.min(baseScore + bonus, 100)
}

// ============================================================================
// Stats
// ============================================================================

export async function getImportStats(): Promise<{
  ccodCount: number
  ocodCount: number
  lastCcodImport: Date | null
  lastOcodImport: Date | null
}> {
  const [ccodCount, ocodCount, lastCcod, lastOcod] = await Promise.all([
    prisma.companyOwnership.count({ where: { isOverseas: false } }),
    prisma.companyOwnership.count({ where: { isOverseas: true } }),
    prisma.landRegistryImport.findFirst({
      where: { datasetType: "CCOD", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    prisma.landRegistryImport.findFirst({
      where: { datasetType: "OCOD", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ])

  return {
    ccodCount,
    ocodCount,
    lastCcodImport: lastCcod?.completedAt ?? null,
    lastOcodImport: lastOcod?.completedAt ?? null,
  }
}
