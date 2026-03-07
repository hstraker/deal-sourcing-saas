/**
 * /vendor-response
 * Public page shown to vendors after clicking accept/reject in the offer email.
 */

import { Suspense } from "react"
import VendorResponseContent from "./vendor-response-content"

// Always render dynamically — this page depends on search params
export const dynamic = "force-dynamic"

export default function VendorResponsePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            fontFamily: "Arial, sans-serif",
            color: "#94a3b8",
            maxWidth: 560,
            margin: "60px auto",
            padding: "20px",
            textAlign: "center",
          }}
        >
          Loading…
        </div>
      }
    >
      <VendorResponseContent />
    </Suspense>
  )
}
