import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Edit } from "lucide-react"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"
import { ToggleProvider, ToggleButtons, ToggleableMetrics, ToggleableMap } from "@/components/deals/deal-detail-sections"
import type { DealScoreBreakdown } from "@/lib/deal-scoring"
import { getSignedDownloadUrl } from "@/lib/s3"
import { CoverPhotoViewerWithGallery } from "@/components/deals/cover-photo-viewer-with-gallery"
import { DeleteDealButton } from "@/components/deals/delete-deal-button"
import { GenerateInvestorPackButton } from "@/components/deals/generate-investor-pack-button"
import { QuickAssignUser } from "@/components/deals/quick-assign-user"
import { PropertyAnalysisPanel } from "@/components/deals/property-analysis-panel"
import { VendorSection } from "@/components/vendors/vendor-section"
import { ReservationList } from "@/components/reservations/reservation-list"
import { Decimal } from "@prisma/client/runtime/library"

export const dynamic = "force-dynamic"

interface DealDetailPageProps {
  params: {
    id: string
  }
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Only admin and sourcer can view deals
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      vendor: {
        include: {
          _count: {
            select: {
              offers: true,
              aiConversations: true,
            },
          },
        },
      },
      investorReservations: {
        include: {
          investor: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      photos: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
      },
      _count: {
        select: {
          photos: true,
          favorites: true,
          dealViews: true,
        },
      },
    },
  })

  if (!deal) {
    notFound()
  }

  // Check permissions for sourcers
  if (
    session.user.role === "sourcer" &&
    deal.assignedToId !== session.user.id &&
    deal.createdById !== session.user.id &&
    deal.assignedToId !== null
  ) {
    redirect("/dashboard/deals")
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-gray-100 text-gray-800",
      review: "bg-yarning/20 text-warning",
      in_progress: "bg-blue-100 text-blue-800",
      ready: "bg-purple-100 text-purple-800",
      listed: "bg-green-100 text-green-800",
      reserved: "bg-orange-100 text-orange-800",
      sold: "bg-success/20 text-success",
      archived: "bg-gray-200 text-gray-600",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const formatCurrency = (amount: number | null | undefined | Decimal) => {
    if (!amount) return "—"
    const numAmount = typeof amount === "object" && "toNumber" in amount ? amount.toNumber() : Number(amount)
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount)
  }

  const scoreBreakdown = (deal.dealScoreBreakdown as DealScoreBreakdown | null) ?? null
  const scoreFactorLabels: Record<keyof DealScoreBreakdown, string> = {
    bmv: "Below Market Value",
    yield: "Yield",
    condition: "Condition",
    location: "Location",
    market: "Market Trends",
    additional: "Additional Factors",
  }

  // Generate presigned URLs for photos (valid for 1 hour)
  const photosWithUrls = await Promise.all(
    deal.photos.map(async (photo) => {
      const signedUrl = await getSignedDownloadUrl(photo.s3Key, 3600)
      return {
        ...photo,
        s3Url: signedUrl,
      }
    })
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/deals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{deal.address}</h1>
            {deal.postcode && (
              <p className="text-muted-foreground">{deal.postcode}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerateInvestorPackButton dealId={deal.id} dealAddress={deal.address} />
          <Link href={`/dashboard/deals/${deal.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          {session.user.role === "admin" && (
            <DeleteDealButton dealId={deal.id} dealAddress={deal.address} />
          )}
        </div>
      </div>

      <ToggleProvider>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Cover Photo with Navigation */}
            {photosWithUrls && photosWithUrls.length > 0 && (
              <CoverPhotoViewerWithGallery
                photos={photosWithUrls.map((photo) => ({
                  id: photo.id,
                  s3Url: photo.s3Url,
                  caption: photo.caption,
                  isCover: photo.isCover,
                }))}
              />
            )}
            <ToggleButtons hasMap={!!(deal.latitude && deal.longitude) || !!deal.address} />
          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Property Type</p>
                  <p className="font-medium capitalize">{deal.propertyType || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bedrooms</p>
                  <p className="font-medium">{deal.bedrooms || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bathrooms</p>
                  <p className="font-medium">{deal.bathrooms || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Square Feet</p>
                  <p className="font-medium">{deal.squareFeet?.toLocaleString() || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Asking Price</p>
                  <p className="text-lg font-bold">{formatCurrency(deal.askingPrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Market Value</p>
                  <p className="text-lg font-medium">{formatCurrency(deal.marketValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Refurb Cost</p>
                  <p className="font-medium">{formatCurrency(deal.estimatedRefurbCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">After Refurb Value</p>
                  <p className="font-medium">{formatCurrency(deal.afterRefurbValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          <ToggleableMetrics>
          {(() => {
            const calculatedMetrics = calculateAllMetrics({
              askingPrice: Number(deal.askingPrice),
              marketValue: deal.marketValue ? Number(deal.marketValue) : null,
              estimatedRefurbCost: deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null,
              afterRefurbValue: deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null,
              estimatedMonthlyRent: deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null,
              bedrooms: deal.bedrooms,
              propertyType: deal.propertyType,
              postcode: deal.postcode || undefined,
            })

            return (
              <Card>
                <CardHeader>
                  <CardTitle>Investment Metrics</CardTitle>
                  <CardDescription>
                    Key performance indicators for this deal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {/* Deal Score */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Deal Score</p>
                  {deal.dealScore !== null ? (
                    <>
                      <p className={`text-3xl font-bold ${
                        deal.dealScore >= 80 ? "text-success" :
                        deal.dealScore >= 70 ? "text-primary" :
                        "text-muted-foreground"
                      }`}>
                        {deal.dealScore}/100
                      </p>
                      {deal.packTier && (
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {deal.packTier} tier
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">—</p>
                  )}
                </div>

                {/* BMV % */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">BMV %</p>
                  {deal.bmvPercentage !== null ? (
                    <>
                      <p className="text-3xl font-bold text-success">
                        {deal.bmvPercentage.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Below Market Value</p>
                    </>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">—</p>
                  )}
                </div>

                {/* Gross Yield */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Gross Yield</p>
                  {calculatedMetrics.grossYield !== null ? (
                    <>
                      <p className="text-3xl font-bold">
                        {calculatedMetrics.grossYield.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Annual rent / Price</p>
                    </>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">—</p>
                  )}
                </div>

                {/* Net Yield */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Net Yield</p>
                  {calculatedMetrics.netYield !== null ? (
                    <>
                      <p className="text-3xl font-bold">
                        {calculatedMetrics.netYield.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">After costs (15%)</p>
                    </>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">—</p>
                  )}
                </div>

                {/* ROI */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ROI</p>
                  {calculatedMetrics.roi !== null ? (
                    <>
                      <p className="text-3xl font-bold text-primary">
                        {calculatedMetrics.roi.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Return on Investment</p>
                    </>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">—</p>
                  )}
                </div>

                {/* ROCE */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ROCE</p>
                  {calculatedMetrics.roce !== null ? (
                    <>
                      <p className="text-3xl font-bold text-primary">
                        {calculatedMetrics.roce.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Return on Capital Employed</p>
                    </>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">—</p>
                  )}
                </div>

                    {/* Cap Rate */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cap Rate</p>
                      {calculatedMetrics.capRate !== null ? (
                        <>
                          <p className="text-3xl font-bold">
                            {calculatedMetrics.capRate.toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">NOI / Market Value</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* GRM */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">GRM</p>
                      {calculatedMetrics.grm !== null ? (
                        <>
                          <p className="text-3xl font-bold">
                            {calculatedMetrics.grm.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Price / Annual Rent</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}
          </ToggleableMetrics>

          {scoreBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle>Deal Score Breakdown</CardTitle>
                <CardDescription>Weighted factors contributing to the overall score</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(scoreBreakdown).map(([key, factor]) => (
                  <div key={key} className="flex items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium">
                        {scoreFactorLabels[key as keyof DealScoreBreakdown] ?? key}
                      </p>
                      <p className="text-xs text-muted-foreground">{factor.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {factor.rawScore !== undefined ? factor.rawScore.toFixed(1) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Weight {(factor.weight * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Financial Insights */}
          {(() => {
            const metrics = calculateAllMetrics({
              askingPrice: Number(deal.askingPrice),
              marketValue: deal.marketValue ? Number(deal.marketValue) : null,
              estimatedRefurbCost: deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null,
              afterRefurbValue: deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null,
              estimatedMonthlyRent: deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null,
              bedrooms: deal.bedrooms,
              propertyType: deal.propertyType,
              postcode: deal.postcode || undefined,
            })

            if (metrics.monthlyCashFlow === null && metrics.cashOnCashReturn === null && metrics.totalAcquisitionCost === null) {
              return null
            }

            return (
              <Card>
                <CardHeader>
                  <CardTitle>Financial Insights</CardTitle>
                  <CardDescription>
                    Cash flow, acquisition costs, and equity analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
                    {/* Cash-on-Cash Return */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cash-on-Cash</p>
                      {metrics.cashOnCashReturn !== null ? (
                        <>
                          <p className="text-2xl font-bold text-primary">
                            {metrics.cashOnCashReturn.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Annual return</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Monthly Cash Flow */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly Cash Flow</p>
                      {metrics.monthlyCashFlow !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${metrics.monthlyCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                            £{metrics.monthlyCashFlow.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">After expenses</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Annual Cash Flow */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Annual Cash Flow</p>
                      {metrics.annualCashFlow !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${metrics.annualCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                            £{metrics.annualCashFlow.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Per year</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Equity Gain */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Equity Gain</p>
                      {metrics.equityGain !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${metrics.equityGain >= 0 ? "text-success" : "text-muted-foreground"}`}>
                            £{metrics.equityGain.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">After refurb</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Payback Period */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Payback Period</p>
                      {metrics.paybackPeriod !== null ? (
                        <>
                          <p className="text-2xl font-bold">
                            {metrics.paybackPeriod.toFixed(1)}yrs
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">To recoup</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {/* Acquisition Cost Breakdown */}
                  {metrics.totalAcquisitionCost !== null && (
                    <div className="pt-6 border-t">
                      <p className="text-sm font-semibold mb-4">Acquisition Cost Breakdown</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-muted-foreground mb-1">Purchase Price</p>
                          <p className="font-semibold">{formatCurrency(deal.askingPrice)}</p>
                        </div>
                        {metrics.stampDuty !== null && (
                          <div>
                            <p className="text-muted-foreground mb-1">Stamp Duty</p>
                            <p className="font-semibold">{formatCurrency(metrics.stampDuty)}</p>
                          </div>
                        )}
                        {metrics.legalFees !== null && (
                          <div>
                            <p className="text-muted-foreground mb-1">Legal Fees</p>
                            <p className="font-semibold">{formatCurrency(metrics.legalFees)}</p>
                          </div>
                        )}
                        {metrics.surveyCost !== null && (
                          <div>
                            <p className="text-muted-foreground mb-1">Survey</p>
                            <p className="font-semibold">{formatCurrency(metrics.surveyCost)}</p>
                          </div>
                        )}
                        {deal.estimatedRefurbCost && (
                          <div>
                            <p className="text-muted-foreground mb-1">Refurb Cost</p>
                            <p className="font-semibold">{formatCurrency(deal.estimatedRefurbCost)}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-semibold">Total Investment Required</p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(metrics.totalAcquisitionCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Mortgage Scenario */}
          {(() => {
            const mortgageMetrics = calculateAllMetrics({
              askingPrice: Number(deal.askingPrice),
              marketValue: deal.marketValue ? Number(deal.marketValue) : null,
              estimatedRefurbCost: deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null,
              afterRefurbValue: deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null,
              estimatedMonthlyRent: deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null,
              bedrooms: deal.bedrooms,
              propertyType: deal.propertyType,
              postcode: deal.postcode || undefined,
            })

            if (!mortgageMetrics.monthlyMortgagePayment) return null

            return (
              <Card>
                <CardHeader>
                  <CardTitle>Mortgage Scenario</CardTitle>
                  <CardDescription>
                    Financial analysis assuming 25% deposit, 4.5% BTL interest rate, 25-year term
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Upfront Costs */}
                    <div>
                      <p className="text-sm font-semibold mb-4">Upfront Investment</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-muted-foreground mb-1">Deposit (25%)</p>
                          <p className="font-semibold">{formatCurrency(mortgageMetrics.mortgageDeposit)}</p>
                        </div>
                        {mortgageMetrics.stampDuty !== null && (
                          <div>
                            <p className="text-muted-foreground mb-1">Stamp Duty</p>
                            <p className="font-semibold">{formatCurrency(mortgageMetrics.stampDuty)}</p>
                          </div>
                        )}
                        {mortgageMetrics.legalFees !== null && (
                          <div>
                            <p className="text-muted-foreground mb-1">Legal Fees</p>
                            <p className="font-semibold">{formatCurrency(mortgageMetrics.legalFees)}</p>
                          </div>
                        )}
                        {mortgageMetrics.surveyCost !== null && (
                          <div>
                            <p className="text-muted-foreground mb-1">Survey</p>
                            <p className="font-semibold">{formatCurrency(mortgageMetrics.surveyCost)}</p>
                          </div>
                        )}
                        {deal.estimatedRefurbCost && (
                          <div>
                            <p className="text-muted-foreground mb-1">Refurb Cost</p>
                            <p className="font-semibold">{formatCurrency(deal.estimatedRefurbCost)}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-semibold">Total Cash Required</p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(mortgageMetrics.totalCashRequired)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mortgage & Cash Flow */}
                    <div className="pt-4 border-t">
                      <p className="text-sm font-semibold mb-4">Monthly Cash Flow (Mortgaged)</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Monthly Mortgage Payment */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Monthly Mortgage</p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(mortgageMetrics.monthlyMortgagePayment)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">25yr @ 4.5%</p>
                        </div>

                        {/* Monthly Cash Flow */}
                        {mortgageMetrics.netMonthlyCashFlowMortgaged !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Monthly Cash Flow</p>
                            <p className={`text-2xl font-bold ${mortgageMetrics.netMonthlyCashFlowMortgaged >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatCurrency(mortgageMetrics.netMonthlyCashFlowMortgaged)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">After mortgage & costs</p>
                          </div>
                        )}

                        {/* Annual Cash Flow */}
                        {mortgageMetrics.netAnnualCashFlowMortgaged !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Annual Cash Flow</p>
                            <p className={`text-2xl font-bold ${mortgageMetrics.netAnnualCashFlowMortgaged >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatCurrency(mortgageMetrics.netAnnualCashFlowMortgaged)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Per year</p>
                          </div>
                        )}

                        {/* Cash-on-Cash Return */}
                        {mortgageMetrics.cashOnCashReturnMortgaged !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Cash-on-Cash Return</p>
                            <p className="text-2xl font-bold text-primary">
                              {mortgageMetrics.cashOnCashReturnMortgaged.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">On cash invested</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DCR */}
                    {mortgageMetrics.debtCoverageRatio !== null && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold mb-1">Debt Coverage Ratio (DCR)</p>
                            <p className="text-xs text-muted-foreground">Net Operating Income / Annual Mortgage Payment</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${mortgageMetrics.debtCoverageRatio >= 1.25 ? 'text-success' : mortgageMetrics.debtCoverageRatio >= 1.0 ? 'text-primary' : 'text-destructive'}`}>
                              {mortgageMetrics.debtCoverageRatio.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {mortgageMetrics.debtCoverageRatio >= 1.25 ? 'Excellent (>1.25)' : 
                               mortgageMetrics.debtCoverageRatio >= 1.0 ? 'Good (>1.0)' : 
                               'Low (<1.0)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Deal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Deal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Status</p>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(deal.status)}`}
                    >
                      {formatStatus(deal.status)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Data Source</p>
                    <p className="text-sm font-medium capitalize">{deal.dataSource || "—"}</p>
                  </div>
                  {deal.packTier && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Pack Tier</p>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        {deal.packTier}
                      </span>
                    </div>
                  )}
                  {deal.packPrice && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Pack Price</p>
                      <p className="text-base font-semibold text-primary">
                        {formatCurrency(deal.packPrice)}
                      </p>
                    </div>
                  )}
                  {/* Agent Information */}
                  {(deal.agentName || deal.agentPhone || deal.listingUrl) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Agent Information</p>
                      <div className="space-y-2.5">
                        {deal.agentName && (
                          <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="text-sm font-medium">{deal.agentName}</p>
                          </div>
                        )}
                        {deal.agentPhone && (
                          <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium">{deal.agentPhone}</p>
                          </div>
                        )}
                        {deal.listingUrl && (
                          <div>
                            <p className="text-xs text-muted-foreground">Listing</p>
                            <a
                              href={deal.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary hover:underline break-all"
                            >
                              View Listing
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Engagement Metrics */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Engagement</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg border bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground mb-1">Photos</p>
                        <p className="text-base font-bold text-primary">{deal._count.photos}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground mb-1">Favorites</p>
                        <p className="text-base font-bold text-warning">{deal._count.favorites}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground mb-1">Views</p>
                        <p className="text-base font-bold">{deal._count.dealViews}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground mb-1">Created</p>
                        <p className="text-sm font-medium">
                          {new Date(deal.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Team Information */}
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Team</p>
                    <div className="space-y-3 text-sm">
                      {deal.createdBy && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Created By
                          </p>
                          <p className="font-semibold">{deal.createdBy.firstName} {deal.createdBy.lastName}</p>
                          <p className="text-xs text-muted-foreground">{deal.createdBy.email}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          Assigned To
                        </p>
                        <QuickAssignUser
                          dealId={deal.id}
                          currentAssignedToId={deal.assignedToId}
                          currentAssignedToName={
                            deal.assignedTo
                              ? `${deal.assignedTo.firstName || ""} ${deal.assignedTo.lastName || ""}`.trim() || deal.assignedTo.email
                              : null
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Location Map */}
          {(deal.latitude && deal.longitude) || deal.address ? (
            <ToggleableMap>
              <Card>
                <CardHeader>
                  <CardTitle>Property Location</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Build map URL from coordinates or address
                    let mapUrl = ""
                    if (deal.latitude && deal.longitude) {
                      mapUrl = `https://www.google.com/maps?q=${Number(deal.latitude)},${Number(deal.longitude)}&output=embed`
                    } else {
                      const addressQuery = encodeURIComponent(
                        `${deal.address}${deal.postcode ? `, ${deal.postcode}` : ""}, UK`
                      )
                      mapUrl = `https://www.google.com/maps?q=${addressQuery}&output=embed`
                    }

                    return (
                      <div className="w-full h-[300px] rounded-lg overflow-hidden border">
                        <iframe
                          src={mapUrl}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="w-full h-full"
                        />
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </ToggleableMap>
          ) : null}

          {/* Property Analysis Panel */}
          <PropertyAnalysisPanel
            dealId={deal.id}
            address={deal.address}
            postcode={deal.postcode}
            askingPrice={Number(deal.askingPrice)}
          />

          {/* Vendor Information */}
          <VendorSection dealId={deal.id} vendorId={deal.vendor?.id} />

          {/* Investor Reservations */}
          <ReservationList
            dealId={deal.id}
            initialReservations={deal.investorReservations.map((r) => ({
              ...r,
              reservationFee: Number(r.reservationFee),
            })) as any}
          />
        </div>
        </div>
      </ToggleProvider>
    </div>
  )
}

