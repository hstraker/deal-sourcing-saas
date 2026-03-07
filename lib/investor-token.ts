/**
 * HMAC-SHA256 signed tokens for investor pack download and CTA interest links.
 * No expiry — valid as long as the delivery exists in the DB.
 */

import crypto from "crypto"

interface DownloadPayload {
  deliveryId: string
  dealId: string
  type: "download"
}

interface InterestPayload {
  deliveryId: string
  dealId: string
  investorId: string
  type: "interest"
}

type TokenPayload = DownloadPayload | InterestPayload

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set")
  return secret
}

function sign(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const hmac = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url")
  return `${encoded}.${hmac}`
}

function verify(token: string): TokenPayload | null {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [encoded, sig] = parts
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url")
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expectedSig, "base64url"))) return null
  } catch {
    return null
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString()) as TokenPayload
  } catch {
    return null
  }
}

export function generateDownloadToken(deliveryId: string, dealId: string): string {
  return sign({ deliveryId, dealId, type: "download" })
}

export function generateInterestToken(deliveryId: string, dealId: string, investorId: string): string {
  return sign({ deliveryId, dealId, investorId, type: "interest" })
}

export function verifyDownloadToken(token: string): { valid: boolean; deliveryId?: string; dealId?: string } {
  const payload = verify(token)
  if (!payload || payload.type !== "download") return { valid: false }
  return { valid: true, deliveryId: payload.deliveryId, dealId: payload.dealId }
}

export function verifyInterestToken(token: string): {
  valid: boolean
  deliveryId?: string
  dealId?: string
  investorId?: string
} {
  const payload = verify(token)
  if (!payload || payload.type !== "interest") return { valid: false }
  const p = payload as InterestPayload
  return { valid: true, deliveryId: p.deliveryId, dealId: p.dealId, investorId: p.investorId }
}
