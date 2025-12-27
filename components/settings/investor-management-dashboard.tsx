"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Users,
  TrendingUp,
  FileText,
  Activity,
  DollarSign,
  Eye,
  Download,
  CheckCircle,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"

interface InvestorStats {
  overview: {
    totalInvestors: number
    activeInvestors: number
    totalReservations: number
    activeReservations: number
    totalPurchases: number
    totalRevenue: number
  }
  byStage: Record<string, number>
  packStats: {
    totalPacksSent: number
    packsViewed: number
    packsDownloaded: number
    viewRate: number
    downloadRate: number
  }
  conversionRates: {
    leadToQualified: number
    qualifiedToPurchased: number
    viewingToReserved: number
  }
  recentActivities: Array<{
    id: string
    activityType: string
    description: string | null
    createdAt: Date
    investor: {
      user: {
        firstName: string | null
        lastName: string | null
        email: string
      }
    }
  }>
  topInvestors: Array<{
    id: string
    totalSpent: number
    dealsPurchased: number
    user: {
      firstName: string | null
      lastName: string | null
      email: string
    }
  }>
}

const stageLabels: Record<string, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  VIEWING_DEALS: "Viewing Deals",
  RESERVED: "Reserved",
  PURCHASED: "Purchased",
  INACTIVE: "Inactive",
}

const stageColors: Record<string, string> = {
  LEAD: "bg-gray-100 text-gray-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-green-100 text-green-700",
  VIEWING_DEALS: "bg-purple-100 text-purple-700",
  RESERVED: "bg-yellow-100 text-yellow-700",
  PURCHASED: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-red-100 text-red-700",
}

export function InvestorManagementDashboard() {
  const [stats, setStats] = useState<InvestorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/investors/stats")
      if (!response.ok) throw new Error("Failed to fetch stats")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error fetching stats:", error)
      toast.error("Failed to load investor statistics")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading statistics...</div>
  }

  if (!stats) {
    return <div className="text-center p-8 text-muted-foreground">No data available</div>
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.totalInvestors}</div>
            <p className="text-xs text-muted-foreground">
              {stats.overview.activeInvestors} active in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.overview.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.overview.totalPurchases} purchases completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reservations</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.activeReservations}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.overview.totalReservations} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Packs Sent</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.packStats.totalPacksSent}</div>
            <p className="text-xs text-muted-foreground">
              {stats.packStats.viewRate.toFixed(1)}% view rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Investors by Pipeline Stage</CardTitle>
          <CardDescription>
            Distribution of investors across sales funnel stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(stats.byStage).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Badge className={stageColors[stage]}>
                    {stageLabels[stage] || stage}
                  </Badge>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rates */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead → Qualified</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(stats.conversionRates.leadToQualified)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified → Purchased</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(stats.conversionRates.qualifiedToPurchased)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Viewing → Reserved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(stats.conversionRates.viewingToReserved)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pack Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Investor Pack Performance</CardTitle>
          <CardDescription>Track how investors engage with sent packs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Eye className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Views</p>
                <p className="text-2xl font-bold">{stats.packStats.packsViewed}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.packStats.viewRate.toFixed(1)}% of sent
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Download className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Downloads</p>
                <p className="text-2xl font-bold">{stats.packStats.packsDownloaded}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.packStats.downloadRate.toFixed(1)}% of sent
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <FileText className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{stats.packStats.totalPacksSent}</p>
                <p className="text-xs text-muted-foreground">
                  All investor packs
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Investors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Investors by Spend</CardTitle>
          <CardDescription>Highest value investors ranked by total spend</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Deals Purchased</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.topInvestors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No investors with purchases yet
                  </TableCell>
                </TableRow>
              ) : (
                stats.topInvestors.map((investor) => (
                  <TableRow key={investor.id}>
                    <TableCell>
                      {investor.user.firstName} {investor.user.lastName}
                    </TableCell>
                    <TableCell>{investor.user.email}</TableCell>
                    <TableCell className="text-right">{investor.dealsPurchased}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(investor.totalSpent))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activities
          </CardTitle>
          <CardDescription>Latest investor actions and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivities.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent activities</p>
            ) : (
              stats.recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {activity.investor.user.firstName} {activity.investor.user.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.description || activity.activityType}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">{activity.activityType}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
