import * as React from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

type ValueType = "positive" | "negative" | "highlight" | "neutral"

interface KpiCardProps {
  label: string
  value: string
  valueType?: ValueType
  subLabel?: string
  trend?: {
    direction: "up" | "down"
    value: string
  }
  className?: string
}

const valueClasses: Record<ValueType, string> = {
  positive:  "kpi-value-positive",
  negative:  "kpi-value-negative",
  highlight: "kpi-value-highlight",
  neutral:   "kpi-value-neutral",
}

export function KpiCard({
  label,
  value,
  valueType = "neutral",
  subLabel,
  trend,
  className,
}: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <p className="kpi-label">{label}</p>
      <p className={valueClasses[valueType]}>{value}</p>
      {(subLabel || trend) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.direction === "up" ? "text-green-600" : "text-red-500"
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend.value}
            </span>
          )}
          {subLabel && (
            <span className="text-xs text-gray-400">{subLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default KpiCard
