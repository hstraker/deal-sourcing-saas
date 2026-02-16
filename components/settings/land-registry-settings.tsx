"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Building2,
  Globe,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Loader2,
  Pause,
  Play,
  X,
  Gauge,
} from "lucide-react"
import { toast } from "sonner"

interface ImportRecord {
  id: string
  datasetType: string
  status: string
  recordsImported: number
  recordsTotal: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  pausedAt: string | null
  resumedAt: string | null
  cancelledAt: string | null
  bytesDownloaded: string | null
  bytesTotal: string | null
  downloadSpeed: number | null
  estimatedTimeRemaining: number | null
  createdAt: string
}

interface ImportStats {
  ccodCount: number
  ocodCount: number
  lastCcodImport: string | null
  lastOcodImport: string | null
}

export function LandRegistrySettings() {
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [recentImports, setRecentImports] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null) // "ccod" | "ocod" | "both"
  const [dryRunning, setDryRunning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{
    summary: {
      totalProcessed: number
      totalCorrected: number
      propertyListings: { processed: number; corrected: number; failed: number }
      vendorLeads: { processed: number; corrected: number; failed: number }
    }
    dryRun: boolean
  } | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/land-registry/status")
      if (!res.ok) return
      const data = await res.json()
      setStats(data.stats)
      setRecentImports(data.recentImports ?? [])
    } catch {
      // silently fail on polling
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Poll more frequently while an import is running (every 2 seconds)
  const hasRunningImport = recentImports.some(
    (r) => r.status === "PENDING" || r.status === "RUNNING"
  )

  useEffect(() => {
    if (!hasRunningImport) return
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [hasRunningImport, fetchStatus])

  const triggerImport = async (datasetType: "ccod" | "ocod" | "both") => {
    // Check if there's already data
    const datasetTypes = datasetType === "both" ? ["ccod", "ocod"] : [datasetType]
    const hasExistingData =
      (datasetTypes.includes("ccod") && (stats?.ccodCount ?? 0) > 0) ||
      (datasetTypes.includes("ocod") && (stats?.ocodCount ?? 0) > 0)

    if (hasExistingData) {
      const confirmMessage =
        datasetType === "both"
          ? "Both datasets already have data. Reimporting will skip duplicates but may take a long time. Continue?"
          : `${datasetType.toUpperCase()} already has ${datasetType === "ccod" ? stats?.ccodCount.toLocaleString() : stats?.ocodCount.toLocaleString()} records. Reimporting will skip duplicates but may take a long time. Continue?`

      if (!confirm(confirmMessage)) {
        return
      }
    }

    setImporting(datasetType)
    try {
      const res = await fetch("/api/admin/land-registry/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetType }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409 && data.runningImport) {
          toast.error(
            `Cannot start import: ${data.error}. Please wait for the current import to complete or cancel it first.`,
            { duration: 5000 }
          )
        } else {
          toast.error(data.error ?? "Import failed to start")
        }
        return
      }

      toast.success(data.message ?? "Import started")
      await fetchStatus()
    } catch {
      toast.error("Failed to start import")
    } finally {
      setImporting(null)
    }
  }

  const pauseImport = async (importId: string) => {
    try {
      const res = await fetch(`/api/admin/land-registry/import/${importId}/pause`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to pause import")
        return
      }
      toast.success("Import paused")
      await fetchStatus()
    } catch {
      toast.error("Failed to pause import")
    }
  }

  const resumeImport = async (importId: string) => {
    try {
      const res = await fetch(`/api/admin/land-registry/import/${importId}/resume`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to resume import")
        return
      }
      toast.success("Import resumed")
      await fetchStatus()
    } catch {
      toast.error("Failed to resume import")
    }
  }

  const runPostcodeFix = async (dryRun: boolean) => {
    if (!dryRun && !confirm("This will update postcode data for all property listings and vendor leads. Continue?")) {
      return
    }
    if (dryRun) setDryRunning(true)
    else setFixing(true)
    setFixResult(null)
    try {
      const res = await fetch("/api/admin/fix-postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Postcode fix failed")
        return
      }
      setFixResult({ summary: data.summary, dryRun: data.dryRun })
      toast.success(
        dryRun
          ? `Dry run: ${data.summary?.totalCorrected ?? 0} of ${data.summary?.totalProcessed ?? 0} records would be corrected`
          : `Fixed ${data.summary?.totalCorrected ?? 0} of ${data.summary?.totalProcessed ?? 0} records`
      )
    } catch {
      toast.error("Postcode fix failed")
    } finally {
      if (dryRun) setDryRunning(false)
      else setFixing(false)
    }
  }

  const cancelImport = async (importId: string) => {
    if (!confirm("Are you sure you want to cancel this import? Progress will be lost.")) {
      return
    }
    try {
      const res = await fetch(`/api/admin/land-registry/import/${importId}/cancel`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to cancel import")
        return
      }
      toast.success("Import cancelled")
      await fetchStatus()
    } catch {
      toast.error("Failed to cancel import")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              UK Companies (CCOD)
            </CardTitle>
            <CardDescription className="text-xs">
              Companies registered in England & Wales that own property
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats?.ccodCount != null
                ? stats.ccodCount.toLocaleString()
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.lastCcodImport
                ? `Last imported ${new Date(stats.lastCcodImport).toLocaleDateString()}`
                : "Never imported"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-500" />
              Overseas Companies (OCOD)
            </CardTitle>
            <CardDescription className="text-xs">
              Overseas companies that own property in England & Wales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats?.ocodCount != null
                ? stats.ocodCount.toLocaleString()
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.lastOcodImport
                ? `Last imported ${new Date(stats.lastOcodImport).toLocaleDateString()}`
                : "Never imported"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Land Registry data is used to automatically boost BMV scores for properties owned by
          companies (+10 pts corporate, +7 pts overseas, +5 pts portfolio owners). Data is matched
          by postcode when properties are scraped. Import the full CCOD dataset (~3–5M records)
          monthly and OCOD (~100K records) for overseas ownership intelligence.
        </AlertDescription>
      </Alert>

      {/* Import buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger Import</CardTitle>
          <CardDescription>
            Downloads the latest dataset from HM Land Registry and imports it into your database.
            Imports run in the background and may take 15–60 minutes for the full CCOD dataset.
            {hasRunningImport && (
              <span className="block mt-2 text-orange-600 font-medium">
                ⚠️ An import is currently running. Please wait for it to complete before starting another.
              </span>
            )}
            {!hasRunningImport && (stats?.ccodCount ?? 0) > 0 && (stats?.ocodCount ?? 0) > 0 && (
              <span className="block mt-2 text-blue-600">
                ℹ️ Reimporting will skip duplicate records. Only new or updated records will be added.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => triggerImport("ccod")}
            disabled={!!importing || hasRunningImport}
          >
            {importing === "ccod" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Building2 className="mr-2 h-4 w-4 text-blue-500" />
            )}
            Import CCOD (UK)
          </Button>

          <Button
            variant="outline"
            onClick={() => triggerImport("ocod")}
            disabled={!!importing || hasRunningImport}
          >
            {importing === "ocod" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-2 h-4 w-4 text-purple-500" />
            )}
            Import OCOD (Overseas)
          </Button>

          <Button
            onClick={() => triggerImport("both")}
            disabled={!!importing || hasRunningImport}
          >
            {importing === "both" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Import Both
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchStatus}
            title="Refresh status"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {recentImports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No imports have been run yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentImports.slice(0, 10).map((imp) => (
                <ImportRow key={imp.id} record={imp} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Postcode repair tool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-green-500" />
            Repair Existing Postcodes
          </CardTitle>
          <CardDescription>
            Scans your <strong>scraped property listings</strong> and <strong>vendor leads</strong> and
            corrects postcodes that are wrong (e.g. Zoopla captures SE1 2LH — its own London office —
            instead of the property&apos;s actual postcode) or outcode-only (e.g. SA6 with no incode).
            Uses Land Registry street lookup first, then postcodes.io as fallback.
            <span className="block mt-1 text-muted-foreground">
              Note: this scans your scraped properties, not the 4.4M Land Registry records.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fixResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-sm space-y-1">
                <p className="font-medium">{fixResult.dryRun ? "Dry run complete — no changes saved." : "Postcode repair complete."}</p>
                <p>
                  Scraped listings: scanned <strong>{fixResult.summary.propertyListings.processed.toLocaleString()}</strong>,
                  corrected <strong>{fixResult.summary.propertyListings.corrected.toLocaleString()}</strong>
                  {fixResult.summary.propertyListings.failed > 0 && `, ${fixResult.summary.propertyListings.failed} failed`}.
                </p>
                <p>
                  Vendor leads: scanned <strong>{fixResult.summary.vendorLeads.processed.toLocaleString()}</strong>,
                  corrected <strong>{fixResult.summary.vendorLeads.corrected.toLocaleString()}</strong>
                  {fixResult.summary.vendorLeads.failed > 0 && `, ${fixResult.summary.vendorLeads.failed} failed`}.
                </p>
                {fixResult.summary.totalProcessed === 0 && (
                  <p className="text-amber-700">No records found — the scraper hasn&apos;t been run yet or all records already have correct postcodes.</p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => runPostcodeFix(true)}
              disabled={dryRunning || fixing}
            >
              {dryRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {dryRunning ? "Running dry run…" : "Dry Run (preview only)"}
            </Button>
            <Button
              onClick={() => runPostcodeFix(false)}
              disabled={dryRunning || fixing}
            >
              {fixing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {fixing ? "Fixing…" : "Fix All Postcodes"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Run a dry run first to preview. The fix also runs automatically for every new scrape.
          </p>
        </CardContent>
      </Card>

      {/* BMV scoring info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">BMV Score Bonuses</CardTitle>
          <CardDescription>
            Applied automatically when a scraped property's postcode matches a company-owned record
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
              <div>
                <p className="font-medium">Corporate Owner</p>
                <p className="text-muted-foreground">+10 points — easier negotiation, professional sellers</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Globe className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
              <div>
                <p className="font-medium">Overseas Owner</p>
                <p className="text-muted-foreground">+7 points — potentially motivated, remote management</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
              <div>
                <p className="font-medium">Portfolio Owner</p>
                <p className="text-muted-foreground">+5 points — owns 5+ properties, bulk sale potential</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ImportRow({ record }: { record: ImportRecord }) {
  const isRunning = record.status === "PENDING" || record.status === "RUNNING"
  const isPaused = record.status === "PAUSED"
  const canControl = isRunning || isPaused

  const progress =
    record.recordsTotal > 0
      ? Math.round((record.recordsImported / record.recordsTotal) * 100)
      : 0

  const downloadProgress =
    record.bytesTotal && record.bytesDownloaded
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (Number(record.bytesDownloaded) / Number(record.bytesTotal)) * 100
            )
          )
        )
      : record.bytesTotal && !record.bytesDownloaded
      ? 0 // Show 0% if we have total but no downloaded yet
      : null

  const duration =
    record.startedAt && record.completedAt
      ? Math.round(
          (new Date(record.completedAt).getTime() -
            new Date(record.startedAt).getTime()) /
            1000
        )
      : null

  const formatBytes = (bytes: string | number | null) => {
    if (!bytes) return "—"
    const num = typeof bytes === "string" ? Number(bytes) : bytes
    if (num === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(num) / Math.log(k))
    return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatSpeed = (bytesPerSecond: number | null) => {
    if (!bytesPerSecond) return "—"
    return `${formatBytes(bytesPerSecond)}/s`
  }

  const formatTime = (seconds: number | null) => {
    if (!seconds || seconds < 0) return "—"
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <StatusIcon status={record.status} />
          <span className="font-medium text-sm">{record.datasetType}</span>
          <StatusBadge status={record.status} />
        </div>
        <div className="flex items-center gap-2">
          {canControl && (
            <>
              {isPaused ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const resumeImport = async () => {
                      try {
                        const res = await fetch(
                          `/api/admin/land-registry/import/${record.id}/resume`,
                          { method: "POST" }
                        )
                        if (res.ok) {
                          window.location.reload()
                        }
                      } catch {}
                    }
                    resumeImport()
                  }}
                  className="h-7 px-2"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const pauseImport = async () => {
                      try {
                        const res = await fetch(
                          `/api/admin/land-registry/import/${record.id}/pause`,
                          { method: "POST" }
                        )
                        if (res.ok) {
                          window.location.reload()
                        }
                      } catch {}
                    }
                    pauseImport()
                  }}
                  className="h-7 px-2"
                >
                  <Pause className="h-3 w-3 mr-1" />
                  Pause
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to cancel this import? Progress will be lost."
                    )
                  ) {
                    const cancelImport = async () => {
                      try {
                        const res = await fetch(
                          `/api/admin/land-registry/import/${record.id}/cancel`,
                          { method: "POST" }
                        )
                        if (res.ok) {
                          window.location.reload()
                        }
                      } catch {}
                    }
                    cancelImport()
                  }
                }}
                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(record.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Download Progress */}
      {isRunning && downloadProgress !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Download</span>
            <span className="text-muted-foreground">
              {formatBytes(record.bytesDownloaded)} / {formatBytes(record.bytesTotal)} ({downloadProgress}%)
            </span>
          </div>
          <Progress value={downloadProgress} className="h-1.5" />
          {downloadProgress > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Gauge className="h-3 w-3" />
                <span>{formatSpeed(record.downloadSpeed)}</span>
              </div>
              {record.estimatedTimeRemaining && record.estimatedTimeRemaining > 0 && (
                <span>ETA: {formatTime(record.estimatedTimeRemaining)}</span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Show "Preparing download..." when bytesTotal is set but no bytes downloaded yet */}
      {isRunning && record.bytesTotal && (!record.bytesDownloaded || Number(record.bytesDownloaded) === 0) && (
        <div className="text-xs text-muted-foreground">
          Preparing download... ({formatBytes(record.bytesTotal)} total)
        </div>
      )}

      {/* Import Progress */}
      {isRunning && record.recordsTotal > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Import</span>
            <span className="text-muted-foreground">
              {record.recordsImported.toLocaleString()} /{" "}
              {record.recordsTotal.toLocaleString()} records ({progress}%)
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {record.estimatedTimeRemaining && (
            <p className="text-xs text-muted-foreground">
              Estimated time remaining: {formatTime(record.estimatedTimeRemaining)}
            </p>
          )}
        </div>
      )}

      {isPaused && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
          <p className="text-xs text-yellow-800">
            Paused at {record.recordsImported.toLocaleString()} records. Click Resume to continue.
          </p>
        </div>
      )}

      {record.status === "COMPLETED" && (
        <div className="space-y-1">
          <p className="text-xs text-green-700 font-medium">
            ✓ {record.recordsImported.toLocaleString()} records imported successfully
          </p>
          {duration != null && (
            <p className="text-xs text-muted-foreground">
              Completed in {duration < 60 ? `${duration}s` : `${Math.round(duration / 60)}m ${duration % 60}s`}
            </p>
          )}
        </div>
      )}

      {record.status === "FAILED" && record.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <p className="text-xs text-red-800 font-medium">Import failed</p>
          <p className="text-xs text-red-600 mt-1">{record.errorMessage}</p>
        </div>
      )}

      {record.status === "CANCELLED" && (
        <p className="text-xs text-muted-foreground">
          Cancelled at {record.recordsImported.toLocaleString()} records
        </p>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "FAILED":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "RUNNING":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case "PENDING":
      return <Clock className="h-4 w-4 text-yellow-500" />
    case "PAUSED":
      return <Pause className="h-4 w-4 text-orange-500" />
    case "CANCELLED":
      return <XCircle className="h-4 w-4 text-gray-500" />
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    RUNNING: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    PAUSED: "bg-orange-100 text-orange-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  }
  return (
    <Badge className={variants[status] ?? "bg-gray-100 text-gray-800"}>
      {status}
    </Badge>
  )
}
