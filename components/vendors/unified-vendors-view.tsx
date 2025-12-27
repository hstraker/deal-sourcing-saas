"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table2, Kanban } from "lucide-react"
import { VendorList } from "./vendor-list"
import { VendorPipelineKanbanBoard } from "./vendor-pipeline-kanban-board"

type ViewMode = "table" | "board"

/**
 * UnifiedVendorsView Component
 *
 * Provides a unified vendor management interface with two view modes:
 * - Table View: Dense list view for analysis, filtering, and bulk actions
 * - Board View: Kanban board for visual pipeline management and drag-drop
 *
 * User preference is saved to localStorage for persistence across sessions.
 */
export function UnifiedVendorsView() {
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [isClient, setIsClient] = useState(false)

  // Load saved view preference on mount
  useEffect(() => {
    setIsClient(true)
    const savedView = localStorage.getItem("vendors-view-mode") as ViewMode
    if (savedView === "table" || savedView === "board") {
      setViewMode(savedView)
    }
  }, [])

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("vendors-view-mode", mode)
  }

  // Prevent hydration issues by not rendering until client-side
  if (!isClient) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">
            Manage vendor leads and track them through the acquisition pipeline
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header with View Toggle */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">
            Manage vendor leads and track them through the acquisition pipeline
          </p>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("table")}
            className="gap-2"
          >
            <Table2 className="h-4 w-4" />
            Table
          </Button>
          <Button
            variant={viewMode === "board" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("board")}
            className="gap-2"
          >
            <Kanban className="h-4 w-4" />
            Board
          </Button>
        </div>
      </div>

      {/* Render Active View */}
      <div className="animate-in fade-in duration-200">
        {viewMode === "table" ? (
          <VendorList />
        ) : (
          <VendorPipelineKanbanBoard />
        )}
      </div>
    </div>
  )
}
