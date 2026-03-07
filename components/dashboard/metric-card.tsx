"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
import { ReactNode } from "react"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  tooltip?: string
  icon?: ReactNode
  badge?: {
    label: string
    color: string
  }
  trend?: {
    value: string
    isPositive: boolean
  }
}

export function MetricCard({
  title,
  value,
  description,
  tooltip,
  icon,
  badge,
  trend,
}: MetricCardProps) {
  return (
    <TooltipProvider>
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <h3 className="text-sm font-semibold text-gray-900 text-sm font-medium flex items-center gap-2">            {title}
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </h3>
          {icon}
        </div>
        <div className="p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold">{value}</div>
              {description && (
                <p className="text-xs text-gray-400 mt-1">{description}</p>
              )}
            </div>
            {badge && (
              <Badge className={badge.color} variant="outline">
                {badge.label}
              </Badge>
            )}
          </div>
          {trend && (
            <div className={`text-xs mt-2 ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.value}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}







