"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="ds-card overflow-hidden w-full max-w-md">        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <h3 className="text-sm font-semibold text-gray-900">Something went wrong!</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            An unexpected error occurred. Please try again.
          </p>
        </div>
        <div className="p-5 space-y-4">          {error.message && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
              {error.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              Try again
            </Button>
            <Button onClick={() => window.location.href = "/dashboard"} variant="outline">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

