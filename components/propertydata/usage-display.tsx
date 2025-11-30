"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface UsageStats {
  creditsUsed: number
  creditsRemaining: number
  requestsThisMonth: number
  limit: number
}

export function PropertyDataUsageDisplay() {
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch("/api/propertydata/usage")
        if (response.ok) {
          const data = await response.json()
          setUsage(data)
        }
      } catch (error) {
        console.error("Error fetching usage:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsage()
  }, [])

  // Don't show anything if still loading or if user is not admin (component handles this)
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">PropertyData API Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!usage) {
    return null
  }

  const usagePercentage = (usage.creditsUsed / usage.limit) * 100
  const isNearLimit = usagePercentage > 80
  const isAtLimit = usagePercentage >= 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">PropertyData API Usage</CardTitle>
        <CardDescription className="text-xs">
          Monthly credit limit: {usage.limit.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credits Used</span>
            <span className="font-semibold">
              {usage.creditsUsed.toLocaleString()} / {usage.limit.toLocaleString()}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {usage.creditsRemaining.toLocaleString()} remaining
            </span>
            <span className="text-muted-foreground">
              {usage.requestsThisMonth} requests this month
            </span>
          </div>
        </div>

        {isAtLimit && (
          <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Credit limit reached. New requests will fail until next month.</span>
          </div>
        )}

        {isNearLimit && !isAtLimit && (
          <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 p-2 text-xs text-orange-600 dark:text-orange-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Approaching credit limit. Use cached data when possible.</span>
          </div>
        )}

        {!isNearLimit && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Usage is healthy. {usage.creditsRemaining.toLocaleString()} credits available.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

