import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // ── shadcn/ui base variants (unchanged) ──────────────────────────
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // ── Design system status variants ────────────────────────────────
        tenanted:
          "border-transparent bg-[#DBEAFE] text-[#1D4ED8]",
        vacant:
          "border-transparent bg-[#FEF3C7] text-[#92400E]",
        "main-residence":
          "border-transparent bg-[#F3F4F6] text-[#374151]",
        new:
          "border-transparent bg-[#DCFCE7] text-[#166534]",
        hot:
          "border-transparent bg-[#FEE2E2] text-[#991B1B]",
        negotiating:
          "border-transparent bg-[#EDE9FE] text-[#5B21B6]",
        offer:
          "border-transparent bg-[#FEF9C3] text-[#854D0E]",
        // ── Pipeline stage variants ──────────────────────────────────────
        lead:
          "border-transparent bg-blue-100 text-blue-700",
        contacted:
          "border-transparent bg-purple-100 text-purple-700",
        qualified:
          "border-transparent bg-indigo-100 text-indigo-700",
        "viewing-deals":
          "border-transparent bg-amber-100 text-amber-700",
        reserved:
          "border-transparent bg-green-100 text-green-700",
        purchased:
          "border-transparent bg-gray-100 text-gray-600",
        // ── Deal status variants ─────────────────────────────────────────
        review:
          "border-transparent bg-yellow-100 text-yellow-700",
        "in-progress":
          "border-transparent bg-blue-100 text-blue-700",
        ready:
          "border-transparent bg-green-100 text-green-700",
        listed:
          "border-transparent bg-purple-100 text-purple-700",
        sold:
          "border-transparent bg-gray-100 text-gray-500",
        archived:
          "border-transparent bg-gray-50 text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
