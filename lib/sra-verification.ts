/**
 * SRA (Solicitors Regulation Authority) verification helper.
 *
 * Fetches the individual solicitor register page from the SRA public register
 * and parses the authorisation status. No API key required — the SRA register
 * is publicly accessible.
 *
 * Register URL format:
 *   https://www.sra.org.uk/consumers/register/individual/?id={sraNumber}
 */

export interface SRAVerificationResult {
  verified: boolean
  status: string | null       // "Authorised" | "Not authorised" | "Not found" | etc.
  displayName: string | null  // solicitor name as shown on SRA register
  firmName: string | null     // firm name from register
  error?: string
}

const FETCH_TIMEOUT_MS = 10_000
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; DealSourcer/1.0; +verification)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-GB,en;q=0.9",
}

export async function verifySolicitorSRA(
  sraNumber: string
): Promise<SRAVerificationResult> {
  if (!sraNumber?.trim()) {
    return { verified: false, status: null, displayName: null, firmName: null, error: "No SRA number provided" }
  }

  // Try individual register first, then organisation register
  const urls = [
    `https://www.sra.org.uk/consumers/register/individual/?id=${encodeURIComponent(sraNumber.trim())}`,
    `https://www.sra.org.uk/consumers/register/organisation/?sraNumber=${encodeURIComponent(sraNumber.trim())}`,
  ]

  let lastError: string | undefined

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (res.status === 404) continue

      if (!res.ok) {
        lastError = `SRA register returned HTTP ${res.status}`
        continue
      }

      const html = await res.text()

      // Detect "not found" page — SRA returns 200 with a "no results" message
      const notFound =
        html.toLowerCase().includes("no results found") ||
        html.toLowerCase().includes("we couldn't find") ||
        html.toLowerCase().includes("no individual found") ||
        html.toLowerCase().includes("no organisation found")

      if (notFound) continue

      // Parse authorisation status
      let verified = false
      let status: string | null = null

      if (/authorised to practise/i.test(html)) {
        verified = true
        status = "Authorised"
      } else if (/authorised/i.test(html) && !/not authorised/i.test(html)) {
        // Organisation pages may say "Authorised" without "to practise"
        verified = true
        status = "Authorised"
      } else if (/not sra.regulated/i.test(html) || /we do not regulate this/i.test(html)) {
        // Firm appears in register but is regulated by another body (e.g. CLC)
        verified = true  // They exist and are in the register
        status = "Listed — not SRA-regulated"
      } else if (/not authorised/i.test(html)) {
        verified = false
        status = "Not authorised"
      } else if (/non-practising/i.test(html)) {
        verified = false
        status = "Non-practising"
      } else if (/struck off/i.test(html)) {
        verified = false
        status = "Struck off"
      } else if (/suspended/i.test(html)) {
        verified = false
        status = "Suspended"
      } else if (html.length > 5000) {
        // Page loaded with content — mark as found even if we can't parse exact status
        verified = true
        status = "Found on SRA register"
      }

      // Parse display name from <h1> or page title
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/)
      const titleMatch = html.match(/<title>([^<|]+)/)
      let displayName: string | null =
        h1Match?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? null
      if (displayName) {
        displayName = displayName
          .replace(/\s*[-|]\s*SRA.*$/i, "")
          .replace(/\s*[-|]\s*Solicitors Regulation.*$/i, "")
          .trim()
      }

      // Parse firm name
      const firmMatch =
        html.match(/Current employer[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)</i) ??
        html.match(/Firm[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)</i) ??
        html.match(/Organisation[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)</i)
      const firmName = firmMatch?.[1]?.trim() ?? null

      if (status !== null) {
        return { verified, status, displayName, firmName }
      }
    } catch (err: any) {
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError"
      lastError = isTimeout
        ? "SRA register request timed out — try again"
        : (err?.message ?? "Unknown error contacting SRA register")
    }
  }

  // Neither URL returned a usable result
  return {
    verified: false,
    status: lastError ? null : "Not found on SRA register",
    displayName: null,
    firmName: null,
    error: lastError,
  }
}
