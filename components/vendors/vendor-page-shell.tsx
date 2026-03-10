"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface VendorPageShellProps {
  leadId: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  children: React.ReactNode
}

const TABS = [
  { label: "Contact Info",   segment: "contact" },
  { label: "Comparables",    segment: "comparables" },
  { label: "Validation",     segment: "validation" },
  { label: "Offer Analysis", segment: "offer-analysis" },
  { label: "Activity",       segment: "activity" },
]

export function VendorPageShell({
  leadId,
  vendorName,
  propertyAddress,
  propertyPostcode,
  children,
}: VendorPageShellProps) {
  const pathname = usePathname()
  const baseUrl = `/dashboard/vendors/${leadId}`

  const displayAddress =
    [propertyAddress, propertyPostcode].filter(Boolean).join(", ") || "No address recorded"

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link
          href="/dashboard/vendors"
          className="hover:text-gray-700 transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Vendor Leads
        </Link>
        <span>/</span>
        <span className="text-gray-700">{vendorName}</span>
      </div>

      {/* Vendor header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{vendorName}</h1>
        <p className="text-sm text-gray-400 mt-1">{displayAddress}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-[var(--ds-border)] mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const href = `${baseUrl}/${tab.segment}`
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Page content */}
      {children}
    </div>
  )
}
