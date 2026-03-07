import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="ds-card overflow-hidden w-full max-w-md">        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <h3 className="text-sm font-semibold text-gray-900">404 - Page Not Found</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
        <div className="p-5">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

