import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RateLimitMonitor } from "@/components/vendor-pipeline/rate-limit-monitor"
import { VendorPipelineCard } from "@/components/dashboard/vendor-pipeline-card"
import { TimeInStagesCard } from "@/components/dashboard/time-in-stages-card"
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Building2, Users, TrendingUp, Plus, DollarSign } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

// Mark this page as dynamic since it uses server-side data
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  // Get dashboard stats
  const totalDeals = await prisma.deal.count()
  const dealsThisMonth = await prisma.deal.count({
    where: {
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  })
  const dealsListed = await prisma.deal.count({
    where: { status: "listed" },
  })
  const dealsSold = await prisma.deal.count({
    where: { status: "sold" },
  })

  // Get vendor stats
  const totalVendors = await prisma.vendor.count()
  const vendorsWithOffers = await prisma.vendor.count({
    where: { status: { in: ["offer_made", "negotiating"] } },
  })
  const vendorsAccepted = await prisma.vendor.count({
    where: { status: "offer_accepted" },
  })

  // Get reservation stats
  const totalReservations = await prisma.investorReservation.count()
  const reservationsWithProof = await prisma.investorReservation.count({
    where: { proofOfFundsVerified: true },
  })

  // Calculate conversion rate
  const vendorConversionRate = totalVendors > 0
    ? ((vendorsAccepted / totalVendors) * 100).toFixed(1)
    : "0"

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {session?.user?.name || session?.user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/deals/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Deal
              </Button>
            </Link>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border-blue-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total Deals
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm font-medium mb-1">Total Deals</p>
                    <p className="text-xs">
                      All deals in the system across all stages: new, review, in_progress, ready, listed, reserved, sold, and archived.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{totalDeals}</div>
              <p className="text-xs text-blue-600/70 mt-1 font-medium">
                +{dealsThisMonth} this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50/50 to-green-50/50 border-emerald-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Active Vendors
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm font-medium mb-1">Active Vendors</p>
                    <p className="text-xs">
                      Total vendors in the system from all sources (Facebook ads, manual entry). Each vendor represents a potential property seller.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Building2 className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-700">{totalVendors}</div>
              <p className="text-xs text-emerald-600/70 mt-1 font-medium">
                {vendorsWithOffers} with offers
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 border-purple-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Reservations
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm font-medium mb-1">Total Reservations</p>
                    <p className="text-xs">
                      All investor reservations across all deals and statuses. Each reservation represents investor interest in a specific deal.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700">{totalReservations}</div>
              <p className="text-xs text-purple-600/70 mt-1 font-medium">
                {reservationsWithProof} verified
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 border-amber-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Conversion Rate
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm font-medium mb-1">Vendor Conversion Rate</p>
                    <p className="text-xs">
                      (Accepted Offers / Total Vendors) × 100 = {vendorConversionRate}%. Shows percentage of vendors who accepted offers.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-700">{vendorConversionRate}%</div>
              <p className="text-xs text-amber-600/70 mt-1 font-medium">
                {vendorsAccepted} accepted
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Rate Limits & Usage Statistics */}
        <RateLimitMonitor />

        {/* Pipeline Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <VendorPipelineCard />
          <TimeInStagesCard />
        </div>

        {/* Detailed Analytics Section */}
        <DashboardAnalytics />
      </div>
    </TooltipProvider>
  )
}
