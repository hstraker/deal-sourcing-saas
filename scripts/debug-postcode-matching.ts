/**
 * Debug: Postcode Resolution Matching
 *
 * Pulls a sample of PropertyListings and VendorLeads that have wrong/missing
 * postcodes from the DB, then runs each through every step of the resolution
 * chain in isolation so we can see exactly where matching fails.
 *
 * Also queries the PPD and CCOD tables directly to show what raw data exists
 * for the outcodes in question.
 *
 * Usage:
 *   npx tsx scripts/debug-postcode-matching.ts
 *   npx tsx scripts/debug-postcode-matching.ts --limit 20
 *   npx tsx scripts/debug-postcode-matching.ts --address "23 High Street, Swansea SA6"
 *
 * Output: logs/debug-postcode-{timestamp}.log  +  .json
 */

import * as fs from "fs"
import * as path from "path"
import { PrismaClient, Prisma } from "@prisma/client"

// Load .env without requiring the dotenv package (tsx reads tsconfig paths)
const envFile = path.join(process.cwd(), ".env")
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const LOG_DIR = path.join(process.cwd(), "logs")
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)
const LOG_FILE = path.join(LOG_DIR, `debug-postcode-${ts}.log`)
const JSON_FILE = path.join(LOG_DIR, `debug-postcode-${ts}.json`)

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + "\n")
}

function hr(char = "─", width = 80) {
  log(char.repeat(width))
}

function getArg(name: string, defaultVal?: string): string | undefined {
  const args = process.argv.slice(2)
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1]
  return defaultVal
}

// ── Regex (must mirror land-registry.ts exactly) ─────────────────────────────

const FULL_PC_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2})\b/i
const OUTCODE_ONLY_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/gi

function extractOutcode(address: string): string | null {
  const matches = [...address.matchAll(OUTCODE_ONLY_RE)]
  const candidates = matches
    .map((m) => m[1].toUpperCase())
    .filter((s) => /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(s) && s.length >= 2)
  return candidates.length > 0 ? candidates[candidates.length - 1] : null
}

function normalizeStreet(street: string): string {
  return street.toLowerCase().trim().replace(/\s+/g, " ")
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient()
  const limit = parseInt(getArg("limit", "15")!, 10)
  const singleAddress = getArg("address")

  const results: Record<string, unknown>[] = []

  log("=".repeat(80))
  log("POSTCODE RESOLUTION DEBUG SCRIPT")
  log(`Log file:  ${LOG_FILE}`)
  log(`JSON file: ${JSON_FILE}`)
  log("=".repeat(80))

  // ── PPD / CCOD table counts ──────────────────────────────────────────────
  hr()
  log("SECTION 0: Database table sizes")
  hr()

  const [ppdCount, ccodCount] = await Promise.all([
    prisma.pricePaidAddress.count(),
    prisma.companyOwnership.count(),
  ])
  log(`  PricePaidAddress rows : ${ppdCount.toLocaleString()}`)
  log(`  CompanyOwnership rows : ${ccodCount.toLocaleString()}`)
  log(
    ppdCount === 0
      ? "  ⚠️  PPD table is EMPTY — import a year from Settings > Land Registry first"
      : "  ✓  PPD data is present"
  )
  log(
    ccodCount === 0
      ? "  ⚠️  CCOD table is EMPTY — CCOD/OCOD not imported"
      : "  ✓  CCOD data is present"
  )

  // ── Build address list to test ───────────────────────────────────────────
  const testAddresses: Array<{ id: string; table: string; displayAddress: string; storedPostcode: string | null }> = []

  if (singleAddress) {
    testAddresses.push({
      id: "CLI",
      table: "CLI",
      displayAddress: singleAddress,
      storedPostcode: null,
    })
  } else {
    // PropertyListing — grab up to limit/2 records where postcode looks wrong or missing
    const plRows = await prisma.propertyListing.findMany({
      take: Math.ceil(limit / 2),
      select: { id: true, source: true, address: true },
      orderBy: { scrapedAt: "desc" },
    })

    for (const r of plRows) {
      const addr = r.address as Record<string, unknown> | null
      const display = typeof addr?.displayAddress === "string" ? addr.displayAddress : null
      const stored = typeof addr?.postcode === "string" ? addr.postcode : null
      if (!display) continue

      // Prioritise records where postcode is missing or outcode-only
      const isSuspect =
        !stored ||
        !/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}\b/i.test(stored)

      testAddresses.push({
        id: r.id,
        table: `PropertyListing (${r.source})`,
        displayAddress: display,
        storedPostcode: stored,
      })
      void isSuspect // used for ordering — push all, user can see which are suspect
    }

    // VendorLead — grab up to limit/2
    const vlRows = await prisma.vendorLead.findMany({
      take: Math.floor(limit / 2),
      select: { id: true, propertyAddress: true, propertyPostcode: true },
      where: { propertyAddress: { not: null } },
      orderBy: { createdAt: "desc" },
    })
    for (const r of vlRows) {
      if (!r.propertyAddress) continue
      testAddresses.push({
        id: r.id,
        table: "VendorLead",
        displayAddress: r.propertyAddress,
        storedPostcode: r.propertyPostcode,
      })
    }
  }

  log(`\n  Testing ${testAddresses.length} addresses`)

  // ── Per-address resolution trace ─────────────────────────────────────────
  hr("=")
  log("SECTION 1: Per-address resolution trace")
  hr("=")

  for (const [i, item] of testAddresses.entries()) {
    hr()
    log(`[${i + 1}/${testAddresses.length}] ${item.table} | id=${item.id}`)
    log(`  Address  : "${item.displayAddress}"`)
    log(`  Stored PC: "${item.storedPostcode ?? "(none)"}"`)

    const result: Record<string, unknown> = {
      id: item.id,
      table: item.table,
      address: item.displayAddress,
      storedPostcode: item.storedPostcode,
    }

    // ── Step 0: extract outcode from address ─────────────────────────────
    const outcode = extractOutcode(item.displayAddress)
    log(`  Outcode extracted from address: ${outcode ?? "(none found)"}`)
    result.outcode = outcode

    if (!outcode) {
      log("  ✗ No outcode — cannot resolve. Address may be too vague.")
      result.outcome = "NO_OUTCODE"
      results.push(result)
      continue
    }

    // ── Step 0b: validate stored postcode against outcode ────────────────
    const storedTrimmed = item.storedPostcode?.trim().toUpperCase().replace(/\s+/g, " ") ?? ""
    const storedIsFull = FULL_PC_RE.test(storedTrimmed)
    const storedOutcode = storedIsFull ? storedTrimmed.split(" ")[0] : ""
    const storedMatchesArea = storedIsFull && storedOutcode === outcode

    log(`  Stored postcode is full?         ${storedIsFull}`)
    log(`  Stored outcode ("${storedOutcode}") matches address outcode ("${outcode}")?  ${storedMatchesArea}`)

    if (storedMatchesArea) {
      log("  ✓ Stored postcode is correct — no fix needed")
      result.outcome = "STORED_OK"
      results.push(result)
      continue
    }

    // ── Step 1a: CCOD street name lookup ─────────────────────────────────
    const streetName = item.displayAddress.split(",")[0].trim()
    log(`  Street name (first comma segment): "${streetName}"`)
    result.streetName = streetName

    if (ccodCount > 0 && streetName.length > 3) {
      const ccodStreet = await prisma.companyOwnership.findFirst({
        where: {
          AND: [
            { propertyAddress: { contains: streetName, mode: "insensitive" } },
            { postcode: { startsWith: outcode + " " } },
          ],
        },
        select: { postcode: true, propertyAddress: true },
      })
      log(`  [CCOD] Street+outcode lookup: ${ccodStreet ? `"${ccodStreet.postcode}" (addr: "${ccodStreet.propertyAddress?.substring(0, 60)}")` : "no match"}`)
      result.ccodStreetMatch = ccodStreet?.postcode ?? null
    } else {
      log(`  [CCOD] skipped (table empty or street too short)`)
      result.ccodStreetMatch = null
    }

    // ── Step 1b: CCOD representative postcode for outcode ────────────────
    if (ccodCount > 0) {
      const ccodRep = await prisma.companyOwnership.findFirst({
        where: { postcode: { startsWith: outcode + " " } },
        select: { postcode: true },
      })
      log(`  [CCOD] Representative postcode for outcode "${outcode}": ${ccodRep?.postcode ?? "none"}`)
      result.ccodRepresentative = ccodRep?.postcode ?? null
    }

    // ── Step 2a: PPD exact street name lookup ────────────────────────────
    if (ppdCount > 0) {
      const streetNorm = normalizeStreet(streetName)
      log(`  Street name normalised: "${streetNorm}"`)
      result.streetNorm = streetNorm

      // Show what the first segment of the address looks like when split on comma
      // and then any additional split candidates (on spaces, to strip house numbers)
      const wordTokens = streetNorm.split(" ")
      const withoutFirstWord = wordTokens.slice(1).join(" ") // strip house number
      const withoutFirstTwoWords = wordTokens.slice(2).join(" ") // strip "Flat 3 High Street" → "High Street"
      log(`  Strip 1st word (house no.)  : "${withoutFirstWord}"`)
      log(`  Strip 1st+2nd words         : "${withoutFirstTwoWords}"`)

      // Exact match
      const ppdExact = await prisma.pricePaidAddress.findFirst({
        where: {
          streetNorm: streetNorm,
          postcode: { startsWith: outcode + " " },
        },
        select: { postcode: true, street: true, streetNorm: true },
      })
      log(`  [PPD] Exact streetNorm match: ${ppdExact ? `"${ppdExact.postcode}" (raw: "${ppdExact.street}")` : "no match"}`)
      result.ppdExact = ppdExact?.postcode ?? null

      // Contains match (current code)
      const ppdContains = await prisma.pricePaidAddress.findFirst({
        where: {
          streetNorm: { contains: streetNorm },
          postcode: { startsWith: outcode + " " },
        },
        select: { postcode: true, street: true, streetNorm: true },
      })
      log(`  [PPD] Contains streetNorm    : ${ppdContains ? `"${ppdContains.postcode}" (raw: "${ppdContains.street}", norm: "${ppdContains.streetNorm}")` : "no match"}`)
      result.ppdContains = ppdContains?.postcode ?? null

      // Strip house number — match on the words AFTER the first token
      let ppdStripped: { postcode: string; street: string; streetNorm: string } | null = null
      if (!ppdContains && withoutFirstWord.length > 2) {
        ppdStripped = await prisma.pricePaidAddress.findFirst({
          where: {
            streetNorm: { contains: withoutFirstWord },
            postcode: { startsWith: outcode + " " },
          },
          select: { postcode: true, street: true, streetNorm: true },
        }) ?? null
        log(`  [PPD] Strip-1st-word match   : ${ppdStripped ? `"${ppdStripped.postcode}" (raw: "${ppdStripped.street}")` : "no match"}`)
      }
      result.ppdStripped = ppdStripped?.postcode ?? null

      // Strip two words
      let ppdStripped2: { postcode: string; street: string; streetNorm: string } | null = null
      if (!ppdContains && !ppdStripped && withoutFirstTwoWords.length > 2) {
        ppdStripped2 = await prisma.pricePaidAddress.findFirst({
          where: {
            streetNorm: { contains: withoutFirstTwoWords },
            postcode: { startsWith: outcode + " " },
          },
          select: { postcode: true, street: true, streetNorm: true },
        }) ?? null
        log(`  [PPD] Strip-2-words match    : ${ppdStripped2 ? `"${ppdStripped2.postcode}" (raw: "${ppdStripped2.street}")` : "no match"}`)
      }
      result.ppdStripped2 = ppdStripped2?.postcode ?? null

      // What PPD rows DO exist for this outcode? (show up to 5 samples)
      const ppdSamples = await prisma.pricePaidAddress.findMany({
        where: { postcode: { startsWith: outcode + " " } },
        select: { postcode: true, street: true, streetNorm: true },
        take: 5,
      })
      log(`  [PPD] Sample rows for outcode "${outcode}" (up to 5):`)
      if (ppdSamples.length === 0) {
        log(`    (none — outcode "${outcode}" is NOT in the PPD table at all)`)
      } else {
        for (const s of ppdSamples) {
          log(`    postcode="${s.postcode}" | streetNorm="${s.streetNorm}" | raw="${s.street}"`)
        }
      }
      result.ppdSamplesForOutcode = ppdSamples
    } else {
      log(`  [PPD] skipped (table empty)`)
    }

    // ── Step 3: postcodes.io ─────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes?q=${encodeURIComponent(outcode)}&limit=1`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const body = (await res.json()) as { result?: Array<{ postcode: string }> }
        const first = body?.result?.[0]?.postcode ?? null
        log(`  [postcodes.io] Outcode "${outcode}" → ${first ?? "no result"}`)
        result.postcodeIo = first
      } else {
        log(`  [postcodes.io] HTTP ${res.status} for outcode "${outcode}"`)
        result.postcodeIo = null
      }
    } catch (e: any) {
      log(`  [postcodes.io] Error: ${e.message}`)
      result.postcodeIo = null
    }

    // ── Summary ──────────────────────────────────────────────────────────
    const resolvedVia =
      result.ccodStreetMatch ? "CCOD_STREET" :
      result.ccodRepresentative ? "CCOD_REP" :
      result.ppdExact ? "PPD_EXACT" :
      result.ppdContains ? "PPD_CONTAINS" :
      result.ppdStripped ? "PPD_STRIPPED" :
      result.ppdStripped2 ? "PPD_STRIPPED2" :
      result.postcodeIo ? "POSTCODES_IO" : "UNRESOLVED"

    const resolvedPostcode =
      (result.ccodStreetMatch as string) ||
      (result.ccodRepresentative as string) ||
      (result.ppdExact as string) ||
      (result.ppdContains as string) ||
      (result.ppdStripped as string) ||
      (result.ppdStripped2 as string) ||
      (result.postcodeIo as string) ||
      null

    log(`  ► RESULT: ${resolvedVia} → ${resolvedPostcode ?? "FAILED"}`)
    result.resolvedVia = resolvedVia
    result.resolvedPostcode = resolvedPostcode

    results.push(result)
  }

  // ── Summary table ────────────────────────────────────────────────────────
  hr("=")
  log("SECTION 2: Summary")
  hr("=")

  const counts: Record<string, number> = {}
  for (const r of results) {
    const k = String(r.resolvedVia ?? r.outcome ?? "unknown")
    counts[k] = (counts[k] ?? 0) + 1
  }
  for (const [k, v] of Object.entries(counts)) {
    log(`  ${k.padEnd(20)} : ${v}`)
  }

  const unresolved = results.filter(
    (r) => r.resolvedVia === "UNRESOLVED" || r.outcome === "NO_OUTCODE"
  )
  log(`\n  ${results.length} addresses tested, ${unresolved.length} completely unresolved`)

  // ── Test NO_OUTCODE addresses through the REAL resolver ──────────────────
  const noOutcodeItems = testAddresses.filter((a) => extractOutcode(a.displayAddress) === null)
  if (noOutcodeItems.length > 0 && ppdCount > 0) {
    hr("=")
    log("SECTION 2b: NO_OUTCODE addresses — testing real resolvePostcodeFromAddress()")
    hr("=")
    log("  (These go through the new PPD town-based fallback path)")

    // Dynamically import the actual resolver to test the real updated code
    const { resolvePostcodeFromAddress } = await import("../lib/land-registry")

    for (const item of noOutcodeItems) {
      log(`\n  Address: "${item.displayAddress}"`)
      try {
        const res = await resolvePostcodeFromAddress(item.displayAddress, item.storedPostcode, new Map())
        if (res) {
          log(`  ► RESOLVED: "${res.postcode}" via ${res.source} (corrected=${res.corrected})`)
        } else {
          log(`  ► STILL UNRESOLVED — no PPD match found for town + street`)

          // Manual PPD town probe to show what the lookup attempts
          const segs = item.displayAddress.split(",").map((s: string) => s.trim()).filter(Boolean)
          const streetSeg = segs[0]
          const townSeg = segs.slice(1).reverse().find((s: string) => s.length > 3) ?? null
          log(`    Street segment : "${streetSeg}"`)
          log(`    Town candidate : "${townSeg}"`)
          if (townSeg) {
            const norm = normalizeStreet(streetSeg)
            const stripped1 = norm.split(" ").slice(1).join(" ")
            const iMode = Prisma.QueryMode.insensitive
            const ppdDirect = await prisma.pricePaidAddress.findFirst({
              where: {
                OR: [
                  { streetNorm: norm, town: { contains: townSeg, mode: iMode } },
                  { streetNorm: { contains: norm }, town: { contains: townSeg, mode: iMode } },
                  ...(stripped1.length >= 3 ? [
                    { streetNorm: stripped1, town: { contains: townSeg, mode: iMode } },
                    { streetNorm: { contains: stripped1 }, town: { contains: townSeg, mode: iMode } },
                  ] : []),
                ],
              },
              select: { postcode: true, street: true, streetNorm: true, town: true },
            })
            if (ppdDirect) {
              log(`    PPD probe found: postcode="${ppdDirect.postcode}" streetNorm="${ppdDirect.streetNorm}" town="${ppdDirect.town}"`)
            } else {
              log(`    PPD probe: no rows matched (street "${norm}" + town "${townSeg}" not in PPD for imported years)`)
              // Show sample PPD rows for that town
              const townSample = await prisma.pricePaidAddress.findMany({
                where: { town: { contains: townSeg, mode: "insensitive" } },
                select: { postcode: true, streetNorm: true, town: true },
                take: 3,
              })
              if (townSample.length === 0) {
                log(`    No PPD rows at all for town "${townSeg}" — town may not be in PPD (need more years imported)`)
              } else {
                log(`    Sample PPD rows for town "${townSeg}":`)
                for (const r of townSample) log(`      "${r.streetNorm}" → ${r.postcode}`)
              }
            }
          }
        }
      } catch (err: any) {
        log(`  ► ERROR: ${err.message}`)
      }
    }
  }

  // ── PPD data quality samples ─────────────────────────────────────────────
  if (ppdCount > 0) {
    hr("=")
    log("SECTION 3: PPD data quality — 10 random rows")
    hr("=")
    const sample = await prisma.pricePaidAddress.findMany({ take: 10, skip: Math.floor(ppdCount / 10) })
    for (const r of sample) {
      log(`  postcode="${r.postcode}" | streetNorm="${r.streetNorm}" | raw="${r.street}" | town="${r.town ?? ""}"`)
    }
  }

  // ── Save JSON ─────────────────────────────────────────────────────────────
  fs.writeFileSync(
    JSON_FILE,
    JSON.stringify({ testedAt: new Date().toISOString(), ppdCount, ccodCount, results }, null, 2)
  )

  log("\n" + "=".repeat(80))
  log(`Done. Log  → ${LOG_FILE}`)
  log(`     JSON → ${JSON_FILE}`)
  log("=".repeat(80))

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
