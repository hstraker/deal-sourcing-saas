/**
 * SRA Register search — searches by firm name using the SRA's public register.
 *
 * Correct search URL:
 *   https://www.sra.org.uk/consumers/register/?searchText={term}&SearchFilter=Firm
 *
 * The response is server-rendered HTML. Each result is an <li> containing an
 * <a> with an onclick like:
 *   onclick="goToOrgDetails(561444)"
 * and an <h3> with the firm name.
 *
 * SRA numbers live inside the onclick JS call, not in href attributes.
 */

export interface SRASearchResult {
  sraNumber: string
  displayName: string
  firmName: string | null
  status: string | null
  type: "firm" | "individual"
}

const FETCH_HEADERS = {
  "Accept": "text/html,application/xhtml+xml",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
  // Tell the server this is an AJAX request so it returns just the results fragment
  "X-Requested-With": "XMLHttpRequest",
}

/**
 * Search the SRA register by firm name.
 * Returns an array of matches (may be empty).
 */
export async function searchSRAByFirmName(term: string): Promise<SRASearchResult[]> {
  const trimmed = term.trim()
  if (!trimmed) return []
  return scrapeSearch(trimmed)
}

async function scrapeSearch(term: string): Promise<SRASearchResult[]> {
  const url = `https://www.sra.org.uk/consumers/register/?searchText=${encodeURIComponent(term)}&SearchFilter=Firm`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: FETCH_HEADERS,
    })
    if (!res.ok) return []

    const html = await res.text()
    return parseResultsHtml(html)
  } catch {
    return []
  }
}

function parseResultsHtml(html: string): SRASearchResult[] {
  const results: SRASearchResult[] = []
  const seen = new Set<string>()

  // SRA numbers appear in onclick handlers on <a> or <li> elements:
  //   onclick="goToOrgDetails(561444)"
  //   onclick="goToPersonDetails(123456)"
  // Also try URL-based patterns as fallback:
  //   href="/consumers/register/organisation/?sraNumber=561444"
  const patterns: Array<{ regex: RegExp; type: "firm" | "individual" }> = [
    { regex: /goToOrgDetails\((\d{4,8})\)/g, type: "firm" },
    { regex: /goToPersonDetails\((\d{4,8})\)/g, type: "individual" },
    { regex: /\/consumers\/register\/organisation\/\?sraNumber=(\d{4,8})/g, type: "firm" },
    { regex: /\/consumers\/register\/(?:person|individual)\/\?(?:sraNumber|id)=(\d{4,8})/g, type: "individual" },
  ]

  for (const { regex, type } of patterns) {
    let m: RegExpExecArray | null
    while ((m = regex.exec(html)) !== null) {
      const sraNumber = m[1]
      if (seen.has(sraNumber)) continue
      seen.add(sraNumber)

      // Grab surrounding HTML (500 chars before + 400 after the match)
      const ctxStart = Math.max(0, m.index - 500)
      const ctxEnd = Math.min(html.length, m.index + 400)
      const ctx = html.slice(ctxStart, ctxEnd)

      const displayName = extractFirmName(ctx, sraNumber)
      const status = extractStatus(ctx)

      results.push({ sraNumber, displayName, firmName: displayName, status, type })
    }
  }

  return results
}

function extractFirmName(ctx: string, fallback: string): string {
  // SRA wraps firm names in <h3> tags inside each result card
  const h3Match = ctx.match(/<h3[^>]*>\s*([^<]{2,120})\s*<\/h3>/i)
  if (h3Match?.[1]?.trim()) return h3Match[1].trim()

  // Fallback: <a> tag text (skipping "javascript:;" hrefs)
  const anchorText = ctx.match(/<a[^>]*href="javascript:[^"]*"[^>]*>\s*([A-Za-z][^<]{2,100})\s*</i)
  if (anchorText?.[1]?.trim()) {
    const t = anchorText[1].trim()
    if (!t.toLowerCase().includes("register")) return t
  }

  // Fallback: <strong> or <b>
  const boldMatch = ctx.match(/<(?:strong|b)[^>]*>([^<]{3,100})<\/(?:strong|b)>/i)
  if (boldMatch?.[1]?.trim()) return boldMatch[1].trim()

  // Fallback: class with "name" or "title"
  const classMatch = ctx.match(/class="[^"]*(?:name|title|heading)[^"]*"[^>]*>\s*([^<]{3,100})/i)
  if (classMatch?.[1]?.trim()) return classMatch[1].trim()

  return `Firm ${fallback}`
}

function extractStatus(ctx: string): string | null {
  if (/sra-regulated\s+firm/i.test(ctx)) return "SRA-regulated"
  if (/regulated by an approved regulator/i.test(ctx) && !/not regulated/i.test(ctx)) return "Regulated (non-SRA)"
  if (/not regulated by an approved regulator/i.test(ctx)) return "Not regulated"
  if (/authorised/i.test(ctx) && !/not authorised/i.test(ctx)) return "Authorised"
  return null
}
