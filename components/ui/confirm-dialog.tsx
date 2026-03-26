"use client"

import { Trash2, Archive, AlertTriangle, Info, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type ConfirmVariant = "destructive" | "archive" | "warning" | "default"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  loading?: boolean
  onConfirm: () => void
}

const VARIANT_CONFIG: Record<
  ConfirmVariant,
  { icon: React.ElementType; iconClass: string; iconBg: string; confirmClass: string }
> = {
  destructive: {
    icon: Trash2,
    iconClass: "text-red-600",
    iconBg: "bg-red-50",
    confirmClass:
      "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
  },
  archive: {
    icon: Archive,
    iconClass: "text-amber-600",
    iconBg: "bg-amber-50",
    confirmClass:
      "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    iconBg: "bg-amber-50",
    confirmClass:
      "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white",
  },
  default: {
    icon: Info,
    iconClass: "text-blue-600",
    iconBg: "bg-blue-50",
    confirmClass:
      "bg-gray-900 hover:bg-gray-700 focus:ring-gray-500 text-white",
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const cfg = VARIANT_CONFIG[variant]
  const Icon = cfg.icon

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Body */}
        <div className="px-6 pt-6 pb-4">
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              {/* Icon circle */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}
              >
                <Icon className={`h-5 w-5 ${cfg.iconClass}`} />
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <AlertDialogTitle className="text-sm font-semibold text-gray-900 leading-snug">
                  {title}
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-sm text-gray-500 leading-relaxed">
                  {description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
        </div>

        {/* Footer */}
        <AlertDialogFooter className="flex flex-row justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${cfg.confirmClass}`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
