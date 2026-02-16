import { createHash } from "crypto"

/**
 * Compute a SHA-256 checksum of key property fields.
 * Used to detect changes between scraping runs — if the checksum
 * matches the stored value, the property hasn't changed.
 */
export function computeChecksum(
  title: string,
  price: number,
  description: string
): string {
  const content = `${title}|${price}|${description.substring(0, 500)}`
  return createHash("sha256").update(content).digest("hex")
}
