/**
 * HMAC-SHA256 signed tokens for vendor offer accept/reject CTA links.
 * Tokens are URL-safe base64 encoded and valid for 14 days.
 * Invalidated when offerTokenVersion increments (i.e. when a new offer is sent).
 */

import crypto from "crypto"

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

interface TokenPayload {
  leadId: string
  version: number
  action: "accept" | "reject"
  exp: number // Unix timestamp ms
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set")
  return secret
}

function sign(payload: TokenPayload): string {
  const data = JSON.stringify(payload)
  const encoded = Buffer.from(data).toString("base64url")
  const hmac = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url")
  return `${encoded}.${hmac}`
}

function verify(token: string): TokenPayload | null {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [encoded, sig] = parts
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url")
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(encoded, "base64url").toString())
    return payload
  } catch {
    return null
  }
}

export function generateVendorOfferToken(
  leadId: string,
  version: number,
  action: "accept" | "reject"
): string {
  return sign({ leadId, version, action, exp: Date.now() + TOKEN_TTL_MS })
}

export interface VerifyResult {
  valid: boolean
  leadId?: string
  action?: "accept" | "reject"
  error?: "expired" | "invalid" | "version_mismatch"
}

export function verifyVendorOfferToken(
  token: string,
  currentVersion: number
): VerifyResult {
  const payload = verify(token)
  if (!payload) return { valid: false, error: "invalid" }
  if (Date.now() > payload.exp) return { valid: false, error: "expired" }
  if (payload.version !== currentVersion) return { valid: false, error: "version_mismatch" }
  return { valid: true, leadId: payload.leadId, action: payload.action }
}
