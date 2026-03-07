"use client"

import { useSearchParams } from "next/navigation"

type ResultType = "accepted" | "rejected" | "expired" | "invalid" | null

const config: Record<
  NonNullable<ResultType>,
  { icon: string; heading: string; body: string; accent: string }
> = {
  accepted: {
    icon: "✅",
    heading: "Offer Accepted",
    body: "Thank you! We have received your acceptance and our team will be in touch shortly to take the next steps.",
    accent: "#16a34a",
  },
  rejected: {
    icon: "✋",
    heading: "Offer Declined",
    body: "We have recorded your decision. If you change your mind or would like to discuss further, please feel free to contact us directly.",
    accent: "#dc2626",
  },
  expired: {
    icon: "⏰",
    heading: "Link Expired",
    body: "This link is no longer valid. It may have expired (links are valid for 14 days) or a new offer has been sent. Please contact us directly if you need assistance.",
    accent: "#d97706",
  },
  invalid: {
    icon: "⚠️",
    heading: "Invalid Link",
    body: "This link is not valid. Please check the email and try again, or contact us directly.",
    accent: "#6b7280",
  },
}

export default function VendorResponseContent() {
  const searchParams = useSearchParams()
  const result = (searchParams.get("result") as ResultType) ?? "invalid"
  const fromName = process.env.NEXT_PUBLIC_COMPANY_NAME || "DealStack"

  const cfg = config[result] ?? config.invalid

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        color: "#333",
        maxWidth: 560,
        margin: "60px auto",
        padding: "20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1e3a8a",
          padding: "28px 28px 20px",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <h1 style={{ color: "white", margin: 0, fontSize: 22 }}>{fromName}</h1>
        <p style={{ color: "rgba(255,255,255,0.8)", margin: "6px 0 0", fontSize: 13 }}>
          Offer Response
        </p>
      </div>

      {/* Body */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderTop: "none",
          padding: "40px 28px",
          borderRadius: "0 0 8px 8px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }}>{cfg.icon}</div>
        <h2
          style={{
            color: cfg.accent,
            margin: "0 0 16px",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {cfg.heading}
        </h2>
        <p style={{ color: "#475569", lineHeight: 1.7, margin: "0 0 24px", fontSize: 16 }}>
          {cfg.body}
        </p>
        <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />
        <p style={{ fontSize: 12, color: "#94a3b8" }}>
          You can close this window. This is a confidential communication from {fromName}.
        </p>
      </div>
    </div>
  )
}
