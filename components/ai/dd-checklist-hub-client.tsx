"use client"

/**
 * DDChecklistHubClient
 *
 * Lead-picker + DD checklist view.
 * Left panel: pick a lead. Right panel: checklist output.
 */

import { useState } from "react"
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline"
import { AILeadPicker, type LeadSummary } from "@/components/ai/ai-lead-picker"
import { DDChecklistPanel } from "@/components/vendors/dd-checklist-panel"

export function DDChecklistHubClient() {
  const [selected, setSelected] = useState<LeadSummary | null>(null)

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardDocumentCheckIcon className="h-6 w-6 text-[#2563EB]" />
          <h1 className="text-2xl font-bold text-gray-900">AI Due Diligence Checklist</h1>
        </div>
        <p className="text-sm text-gray-500">
          Select a lead to generate a tailored DD checklist — Claude reads flood zone, tenure, EPC, ownership flags
          and portal checks to write specific, actionable tasks rather than generic boilerplate.
        </p>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

        {/* Left — lead picker */}
        <div className="lg:sticky lg:top-6">
          <AILeadPicker
            label="Choose a lead"
            description="Recent non-archived vendor leads. Select one to generate its checklist."
            selectedId={selected?.id}
            onSelect={lead => setSelected(lead)}
          />
        </div>

        {/* Right — checklist */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {selected ? (
            <DDChecklistPanel
              key={selected.id}  // remount when lead changes
              leadId={selected.id}
              propertyAddress={selected.propertyAddress}
              autoGenerate
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
              <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-sm font-medium">No lead selected</p>
              <p className="text-xs mt-1 max-w-xs">
                Pick a lead from the panel on the left to generate its AI due diligence checklist.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
