"use client"

/**
 * AIToolHubClient
 *
 * Generic hub page for AI tools that live inside the vendor lead detail modal.
 * Shows a description, a lead picker, and a "Open [Tool]" link for the selected lead.
 */

import { useState } from "react"
import Link from "next/link"
import {
  StarIcon,
  WrenchIcon,
  CameraIcon,
  MapPinIcon,
  UserPlusIcon,
  DocumentMagnifyingGlassIcon,
} from "@heroicons/react/24/outline"
import { ChevronRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AILeadPicker, type LeadSummary } from "@/components/ai/ai-lead-picker"
import { cn } from "@/lib/utils"

const ICON_MAP = {
  star:       StarIcon,
  wrench:     WrenchIcon,
  camera:     CameraIcon,
  "map-pin":  MapPinIcon,
  "user-plus": UserPlusIcon,
  document:   DocumentMagnifyingGlassIcon,
}

const BADGE_COLORS = {
  green: "bg-green-100 text-green-700",
  blue:  "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
}

interface Props {
  title: string
  description: string
  icon: keyof typeof ICON_MAP
  leadLinkPattern: string   // e.g. "/dashboard/vendors?leadId={id}&tab=photos"
  leadLinkLabel: string
  badge?: string
  badgeColor?: keyof typeof BADGE_COLORS
}

export function AIToolHubClient({
  title,
  description,
  icon,
  leadLinkPattern,
  leadLinkLabel,
  badge,
  badgeColor = "blue",
}: Props) {
  const [selected, setSelected] = useState<LeadSummary | null>(null)

  const IconComponent = ICON_MAP[icon]
  const href = selected ? leadLinkPattern.replace("{id}", selected.id) : null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <IconComponent className="h-6 w-6 text-[#2563EB]" />
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {badge && (
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1", BADGE_COLORS[badgeColor])}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 max-w-2xl">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

        {/* Lead picker */}
        <div className="lg:sticky lg:top-6">
          <AILeadPicker
            label="Select a lead"
            selectedId={selected?.id}
            onSelect={setSelected}
          />
        </div>

        {/* Action panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Selected lead</p>
                <p className="text-base font-semibold text-gray-900">
                  {selected.propertyAddress ?? selected.propertyPostcode ?? "Address unknown"}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {selected.bedrooms && <span>{selected.bedrooms} bed</span>}
                  {selected.tenureType && <span>· {selected.tenureType}</span>}
                  {selected.epcRating && <span>· EPC {selected.epcRating}</span>}
                  {selected.askingPrice && (
                    <span>· £{Number(selected.askingPrice).toLocaleString("en-GB")}</span>
                  )}
                </div>
              </div>

              <Link href={href!}>
                <Button className="gap-2 w-full sm:w-auto">
                  {leadLinkLabel}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>

              <p className="text-xs text-gray-400">
                This will open the vendor lead detail modal with the {title.toLowerCase()} tool active.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-center">
              <IconComponent className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-sm font-medium">No lead selected</p>
              <p className="text-xs mt-1 max-w-xs">
                Pick a lead from the panel on the left to open {title.toLowerCase()} for it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
