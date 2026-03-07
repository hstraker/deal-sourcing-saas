"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function InvestorInterestContent() {
  const searchParams = useSearchParams()
  const result = searchParams.get("result")

  const isSuccess = result === "success"

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          maxWidth: "520px",
          width: "100%",
          padding: "48px 40px",
          textAlign: "center",
        }}
      >
        {isSuccess ? (
          <>
            <div style={{ fontSize: "56px", marginBottom: "20px" }}>✅</div>
            <h1 style={{ color: "#1e293b", fontSize: "26px", marginBottom: "12px", fontWeight: 700 }}>
              Interest Registered!
            </h1>
            <p style={{ color: "#475569", fontSize: "16px", lineHeight: 1.6, marginBottom: "24px" }}>
              Thank you for registering your interest. A member of our team will be in touch with you within 24 hours to discuss next steps.
            </p>
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "32px",
              }}
            >
              <p style={{ color: "#166534", fontSize: "14px", margin: 0 }}>
                <strong>What happens next?</strong><br />
                We'll contact you to answer any questions, arrange a viewing if needed, and guide you through the reservation process.
              </p>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "13px" }}>
              You can close this page.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: "56px", marginBottom: "20px" }}>⚠️</div>
            <h1 style={{ color: "#1e293b", fontSize: "26px", marginBottom: "12px", fontWeight: 700 }}>
              Link Invalid
            </h1>
            <p style={{ color: "#475569", fontSize: "16px", lineHeight: 1.6 }}>
              This link is not valid or has already been used. Please contact us directly if you'd like to register your interest.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function InvestorInterestPage() {
  return (
    <Suspense>
      <InvestorInterestContent />
    </Suspense>
  )
}
