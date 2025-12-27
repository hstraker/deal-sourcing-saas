"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Info, Activity } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface RateLimitData {
  current: {
    inputTokensRemaining: number
    inputTokensLimit: number
    inputTokensUsagePercent: number
    outputTokensRemaining: number
    outputTokensLimit: number
    outputTokensUsagePercent: number
    requestsRemaining: number
    requestsLimit: number
    requestsUsagePercent: number
    inputTokensReset?: string
    outputTokensReset?: string
    requestsReset?: string
  }
  history: Array<{
    timestamp: Date
    inputTokensRemaining: number
    inputTokensLimit: number
    tokensUsed: number
  }>
  stats: {
    totalAIMessages: number
    totalTokensUsed: number
    totalInputTokensUsed: number
    totalOutputTokensUsed: number
    avgTokensPerMessage: number
    recentMessagesAnalyzed: number
    estimatedCost: {
      input: number
      output: number
      total: number
    }
  }
}

export function RateLimitMonitor() {
  const [data, setData] = useState<RateLimitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRateLimits = async () => {
    try {
      console.log(`[RateLimitMonitor] Fetching rate limits at ${new Date().toLocaleTimeString()}`)
      const response = await fetch("/api/vendor-pipeline/rate-limits")
      if (!response.ok) {
        throw new Error("Failed to fetch rate limits")
      }
      const json = await response.json()
      console.log(`[RateLimitMonitor] Received data:`, {
        inputTokensRemaining: json.current?.inputTokensRemaining,
        outputTokensRemaining: json.current?.outputTokensRemaining,
        estimatedCost: json.stats?.estimatedCost?.total
      })
      setData(json)
      setError(null)
    } catch (err: any) {
      console.error(`[RateLimitMonitor] Error fetching rate limits:`, err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRateLimits()
    // Refresh every 10 seconds for more real-time updates
    const interval = setInterval(fetchRateLimits, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
              Claude API Rate Limits
            </CardTitle>
            <CardDescription className="text-xs">Loading rate limit data...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-2 bg-muted animate-pulse rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-2 bg-muted animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="h-3 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-6 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Claude API Not Configured</AlertTitle>
              <AlertDescription>
                {error || "Unable to fetch rate limit data. Please ensure your ANTHROPIC_API_KEY is configured in your environment variables."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { current, stats } = data

  // Determine status based on usage
  const getStatus = (usagePercent: number) => {
    if (usagePercent >= 90) return { color: "destructive", icon: AlertTriangle, text: "Critical" }
    if (usagePercent >= 75) return { color: "warning", icon: AlertTriangle, text: "High" }
    if (usagePercent >= 50) return { color: "default", icon: Clock, text: "Moderate" }
    return { color: "success", icon: CheckCircle, text: "Healthy" }
  }

  const inputStatus = getStatus(current.inputTokensUsagePercent)
  const outputStatus = getStatus(current.outputTokensUsagePercent)
  const requestStatus = getStatus(current.requestsUsagePercent)

  const formatTimeUntilReset = (resetTime?: string) => {
    if (!resetTime) return "Unknown"
    const now = new Date()
    const reset = new Date(resetTime)
    const diffMs = reset.getTime() - now.getTime()
    if (diffMs <= 0) return "Now"

    const diffMins = Math.floor(diffMs / 60000)
    const diffSecs = Math.floor((diffMs % 60000) / 1000)

    if (diffMins > 60) {
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      return `${hours}h ${mins}m`
    }
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`
    }
    return `${diffSecs}s`
  }

  return (
    <TooltipProvider>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Warning Alert */}
        {(current.inputTokensUsagePercent >= 80 ||
          current.outputTokensUsagePercent >= 80 ||
          current.requestsUsagePercent >= 80) && (
          <div className="md:col-span-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Rate Limit Warning</AlertTitle>
              <AlertDescription>
                You are approaching your rate limits. Consider reducing prompt size or spacing out requests.
                {current.inputTokensReset && (
                  <span className="block mt-2">
                    Resets in: <strong>{formatTimeUntilReset(current.inputTokensReset)}</strong>
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Rate Limits Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Claude API Rate Limits
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm font-medium mb-2">Tips to Manage Rate Limits</p>
                    <ul className="text-xs space-y-1">
                      <li>• Rate limits reset every minute</li>
                      <li>• System includes automatic retry (3 attempts)</li>
                      <li>• Reduce conversation history to save tokens</li>
                      <li>• Consider upgrading your Anthropic plan</li>
                      <li>• Current limit: {current.inputTokensLimit.toLocaleString()} tokens/min</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Badge
                variant="outline"
                className={
                  inputStatus.text === "Critical" ? "bg-red-100 text-red-800 border-red-200" :
                  inputStatus.text === "High" ? "bg-orange-100 text-orange-800 border-orange-200" :
                  inputStatus.text === "Moderate" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                  "bg-green-100 text-green-800 border-green-200"
                }
              >
                {inputStatus.text}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Real-time API usage (updates every 10s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Input Tokens</span>
                <span className="text-xs font-mono">
                  {current.inputTokensRemaining.toLocaleString()} / {current.inputTokensLimit.toLocaleString()}
                </span>
              </div>
              <Progress
                value={100 - current.inputTokensUsagePercent}
                className={`h-2 ${
                  current.inputTokensUsagePercent >= 90 ? "bg-red-100" :
                  current.inputTokensUsagePercent >= 75 ? "bg-orange-100" :
                  current.inputTokensUsagePercent >= 50 ? "bg-yellow-100" :
                  "bg-green-100"
                }`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{current.inputTokensUsagePercent.toFixed(1)}% used</span>
                {current.inputTokensReset && <span>Resets: {formatTimeUntilReset(current.inputTokensReset)}</span>}
              </div>
            </div>

            {/* Output Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Output Tokens</span>
                <span className="text-xs font-mono">
                  {current.outputTokensRemaining.toLocaleString()} / {current.outputTokensLimit.toLocaleString()}
                </span>
              </div>
              <Progress
                value={100 - current.outputTokensUsagePercent}
                className={`h-2 ${
                  current.outputTokensUsagePercent >= 90 ? "bg-red-100" :
                  current.outputTokensUsagePercent >= 75 ? "bg-orange-100" :
                  current.outputTokensUsagePercent >= 50 ? "bg-yellow-100" :
                  "bg-green-100"
                }`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{current.outputTokensUsagePercent.toFixed(1)}% used</span>
                {current.outputTokensReset && <span>Resets: {formatTimeUntilReset(current.outputTokensReset)}</span>}
              </div>
            </div>

            {/* Requests */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">API Requests</span>
                <span className="text-xs font-mono">
                  {current.requestsRemaining} / {current.requestsLimit}
                </span>
              </div>
              <Progress
                value={100 - current.requestsUsagePercent}
                className={`h-2 ${
                  current.requestsUsagePercent >= 90 ? "bg-red-100" :
                  current.requestsUsagePercent >= 75 ? "bg-orange-100" :
                  current.requestsUsagePercent >= 50 ? "bg-yellow-100" :
                  "bg-green-100"
                }`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{current.requestsUsagePercent.toFixed(1)}% used</span>
                {current.requestsReset && <span>Resets: {formatTimeUntilReset(current.requestsReset)}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Usage Statistics
            </CardTitle>
            <CardDescription className="text-xs">AI conversation metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg bg-blue-50/50">
                <p className="text-xs text-muted-foreground mb-1">Total AI Messages</p>
                <p className="text-xl font-bold text-blue-700">{stats.totalAIMessages.toLocaleString()}</p>
              </div>
              <div className="p-3 border rounded-lg bg-emerald-50/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-xs text-muted-foreground mb-1">Estimated Cost</p>
                      <p className="text-xl font-bold text-emerald-700">
                        ${stats.estimatedCost?.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs font-medium mb-2">Cost Breakdown</p>
                    <div className="text-xs space-y-1">
                      <p>Input: ${stats.estimatedCost?.input?.toFixed(4) || '0.00'}</p>
                      <p>Output: ${stats.estimatedCost?.output?.toFixed(4) || '0.00'}</p>
                      <p className="pt-1 border-t font-medium">Total: ${stats.estimatedCost?.total?.toFixed(4) || '0.00'}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Based on {stats.recentMessagesAnalyzed} recent messages
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="p-3 border rounded-lg bg-purple-50/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-xs text-muted-foreground mb-1">Input Tokens</p>
                      <p className="text-lg font-bold text-purple-700">{(stats.totalInputTokensUsed || 0).toLocaleString()}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Tokens sent to Claude API</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="p-3 border rounded-lg bg-amber-50/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-xs text-muted-foreground mb-1">Output Tokens</p>
                      <p className="text-lg font-bold text-amber-700">{(stats.totalOutputTokensUsed || 0).toLocaleString()}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Tokens generated by Claude</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="mt-4 p-3 border rounded-lg bg-slate-50/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Avg Tokens/Message</p>
                <p className="text-sm font-bold text-slate-700">{stats.avgTokensPerMessage}</p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">Messages Analyzed</p>
                <p className="text-sm font-bold text-slate-700">{stats.recentMessagesAnalyzed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
