import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/dashboard/metric-card"
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Building2, Users, ArrowRight, TrendingUp, Plus } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
  const vendorsContacted = await prisma.vendor.count({
    where: { status: "contacted" },
  })
  const vendorsWithOffers = await prisma.vendor.count({
    where: { status: { in: ["offer_made", "negotiating"] } },
  })
  const vendorsAccepted = await prisma.vendor.count({
    where: { status: "offer_accepted" },
  })
  const totalOffers = await prisma.vendorOffer.count()

  // Get reservation stats
  const totalReservations = await prisma.investorReservation.count()
  const reservationsPending = await prisma.investorReservation.count({
    where: { status: "pending" },
  })
  const reservationsWithProof = await prisma.investorReservation.count({
    where: { proofOfFundsVerified: true },
  })
  const reservationsLockedOut = await prisma.investorReservation.count({
    where: { status: "locked_out" },
  })
  const reservationsCompleted = await prisma.investorReservation.count({
    where: { status: "completed" },
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
          <Card>
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
                      Count of all deals in the system, regardless of status. This includes deals in all stages: new, review, in_progress, ready, listed, reserved, sold, and archived. Calculated from the Deal table.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDeals}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {dealsThisMonth} added this month
              </p>
            </CardContent>
          </Card>

          <Card>
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
                      Total count of all vendors in the system. Includes vendors from all sources (Facebook ads, manual entry) and all statuses. Calculated from the Vendor table. Each vendor represents a potential property seller.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalVendors}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {vendorsWithOffers} with active offers
              </p>
            </CardContent>
          </Card>

          <Card>
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
                      Count of all investor reservations across all deals. This includes reservations in all statuses: pending, fee_pending, proof_of_funds_pending, verified, locked_out, completed, and cancelled. Calculated from the InvestorReservation table. Each reservation represents an investor's interest in a specific deal.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReservations}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {reservationsWithProof} proof verified
              </p>
            </CardContent>
          </Card>

          <Card>
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
                      Calculated as: (Vendors with Accepted Offers / Total Vendors) × 100. This shows the percentage of vendors who accepted offers. Formula: ({vendorsAccepted} / {totalVendors}) × 100 = {vendorConversionRate}%.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendorConversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Vendors accepted offers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Integrated Analytics Section */}
        <DashboardAnalytics />

        {/* Vendor Pipeline Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Vendor Pipeline
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Vendor Pipeline Overview</p>
                      <p className="text-xs">
                        Summary of vendors at each stage of the acquisition workflow. Shows counts for: Contacted (initial AI contact), Active Offers (offer_made or negotiating status), and Accepted (offer_accepted status). Total Offers counts all offers made across all vendors.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription>
                  Track vendors through the acquisition workflow
                </CardDescription>
              </div>
              <Link href="/dashboard/vendors">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Vendors</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Total Vendors</p>
                      <p className="text-xs">
                        Count of all vendors in the system, regardless of status. Includes vendors from all sources (Facebook ads, manual entry) and all workflow stages.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold">{totalVendors}</div>
                <Badge variant="outline" className="mt-2 bg-blue-100 text-blue-800 border-blue-200">
                  All Sources
                </Badge>
              </div>

              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Contacted</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Contacted Vendors</p>
                      <p className="text-xs">
                        Count of vendors where status = "contacted". These are vendors who have received initial AI SMS contact but haven't yet been validated. Calculated from Vendor table where status = 'contacted'.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold">{vendorsContacted}</div>
                <Badge variant="outline" className="mt-2 bg-blue-100 text-blue-800 border-blue-200">
                  Initial Contact
                </Badge>
              </div>

              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Active Offers</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Active Offers</p>
                      <p className="text-xs">
                        Count of vendors where status is "offer_made" or "negotiating". These vendors have received offers and are either considering them or in active negotiation. Calculated from Vendor where status IN ('offer_made', 'negotiating').
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold">{vendorsWithOffers}</div>
                <Badge variant="outline" className="mt-2 bg-yellow-100 text-yellow-800 border-yellow-200">
                  In Negotiation
                </Badge>
              </div>

              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Accepted</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Accepted Offers</p>
                      <p className="text-xs">
                        Count of vendors where status = "offer_accepted". These vendors have accepted an offer and are proceeding to lock-out. Calculated from Vendor where status = 'offer_accepted'.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold">{vendorsAccepted}</div>
                <Badge variant="outline" className="mt-2 bg-purple-100 text-purple-800 border-purple-200">
                  Offer Accepted
                </Badge>
              </div>
            </div>
            <div className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Total Offers Made</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Total Offers Made</p>
                          <p className="text-xs">
                            Sum of all offers made across all vendors. This includes offers in all statuses: pending, accepted, rejected, counter_offered, expired, and withdrawn. Calculated from the VendorOffer table count.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-2xl font-bold">{totalOffers}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Investor Reservations Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Investor Reservations
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Investor Reservations Overview</p>
                      <p className="text-xs">
                        Summary of investor reservations at each stage. Shows: Total (all reservations), Pending (status = pending), Proof Verified (proofOfFundsVerified = true), Locked Out (status = locked_out), and Completed (status = completed). Each reservation represents an investor's interest in a specific deal.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription>
                  Track investor reservations and conversions
                </CardDescription>
              </div>
              <Link href="/dashboard/investors">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-2xl font-bold">{totalReservations}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Total Reservations</p>
                      <p className="text-xs">
                        Count of all investor reservations in the system. This includes reservations in all statuses: pending, fee_pending, proof_of_funds_pending, verified, locked_out, completed, and cancelled. Calculated from the InvestorReservation table. Each reservation links one investor to one deal.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                  Total Reservations
                </Badge>
              </div>

              <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-2xl font-bold">{reservationsPending}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Pending Reservations</p>
                      <p className="text-xs">
                        Count of reservations where status = "pending". These are newly created reservations awaiting action (fee payment, proof of funds, etc.). Calculated from InvestorReservation where status = 'pending'.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  Pending
                </Badge>
              </div>

              <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-2xl font-bold">{reservationsWithProof}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Proof Verified</p>
                      <p className="text-xs">
                        Count of reservations where proofOfFundsVerified = true. This means the investor has provided proof of funds documentation and it has been verified by the team. This is a key milestone in the reservation process. Calculated from InvestorReservation where proofOfFundsVerified = true.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  Proof Verified
                </Badge>
              </div>

              <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-2xl font-bold">{reservationsLockedOut}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Locked Out</p>
                      <p className="text-xs">
                        Count of reservations where status = "locked_out". This means the lock-out agreement has been signed by the investor, securing their reservation. Calculated from InvestorReservation where status = 'locked_out'.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                  Locked Out
                </Badge>
              </div>

              <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-2xl font-bold">{reservationsCompleted}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Completed</p>
                      <p className="text-xs">
                        Count of reservations where status = "completed". These reservations are ready for completion - all requirements met, lock-out signed, and ready to proceed to final completion. Calculated from InvestorReservation where status = 'completed'.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  Completed
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
