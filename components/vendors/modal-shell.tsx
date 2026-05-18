"use client"

import { cn } from "@/lib/utils"
import type React from "react"

interface ModalShellProps {
  onClose: () => void
  leftPanel: React.ReactNode
  maxWidth?: "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full"
  rightPanelClassName?: string
  children: React.ReactNode
}

const MAX_WIDTH: Record<string, string> = {
  "2xl":  "max-w-2xl",
  "3xl":  "max-w-3xl",
  "4xl":  "max-w-4xl",
  "5xl":  "max-w-5xl",
  "6xl":  "max-w-6xl",
  "7xl":  "max-w-7xl",
  "full": "max-w-[96vw]",
}

export function ModalShell({
  onClose,
  leftPanel,
  maxWidth = "2xl",
  rightPanelClassName,
  children,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-2xl shadow-2xl max-h-[90vh]",
          MAX_WIDTH[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[260px] shrink-0 overflow-y-auto bg-[#1e293b] text-white">
          {leftPanel}
        </div>
        <div className={cn("flex flex-1 flex-col overflow-y-auto bg-white", rightPanelClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}
