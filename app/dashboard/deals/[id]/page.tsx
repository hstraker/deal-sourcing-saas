import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { KpiCard } from "@/components/ui/kpi-card"
import { PageHeader } from "@/components/ui/page-header"
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
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"
import { MatchingInvestorsPanel } from "@/components/deals/matching-investors-panel"
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

  const STATUS_COLORS: Record<string, string> = {
    new: "bg-gray-100 text-gray-700",
    review: "bg-amber-50 text-amber-700",
    in_progress: "bg-blue-50 text-blue-700",
    ready: "bg-purple-50 text-purple-700",
    listed: "bg-green-50 text-green-700",
    reserved: "bg-orange-50 text-orange-700",
    sold: "bg-green-100 text-green-800",
    archived: "bg-gray-200 text-gray-600",
  }

  const formatStatus = (status: string) =>
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")

  const formatCurrency = (amount: number | null | undefined | Decimal) => {
    if (!amount) return "—"
    const n = typeof amount === "object" && "toNumber" in amount ? amount.toNumber() : Number(amount)
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)
  }

  const fmtNum = (n: number) =>
    n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

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
      return { ...photo, s3Url: signedUrl }
    })
  )

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

  const hasFinancialInsights =
    calculatedMetrics.monthlyCashFlow !== null ||
    calculatedMetrics.cashOnCashReturn !== null ||
    calculatedMetrics.totalAcquisitionCost !== null

  const hasMortgage = !!calculatedMetrics.monthlyMortgagePayment

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <Link href="/dashboard/deals">
          <Button variant="ghost" size="icon" className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={deal.address}
          subtitle={deal.postcode || undefined}
          className="mb-0 flex-1"
          actions={
            <>
              <GenerateInvestorPackButton dealId={deal.id} dealAddress={deal.address} />
              <Link href={`/dashboard/deals/${deal.id}/edit`}>
                <Button className="btn-primary h-9">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              {session.user.role === "admin" && (
                <DeleteDealButton dealId={deal.id} dealAddress={deal.address} />
              )}
            </>
          }
        />
      </div>

      <ToggleProvider>
        <div className="grid gap-6 md:grid-cols-3">
          {/* ── Main Column ── */}
          <div className="md:col-span-2 space-y-6">
            {/* Cover Photo */}
            {photosWithUrls.length > 0 && (
              <CoverPhotoViewerWithGallery
                photos={photosWithUrls.map((p) => ({
                  id: p.id,
                  s3Url: p.s3Url,
                  caption: p.caption,
                  isCover: p.isCover,
                }))}
              />
            )}

            <ToggleButtons hasMap={!!(deal.latitude && deal.longitude) || !!deal.address} />

            {/* Property Details */}
            <div className="ds-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                <h2 className="text-sm font-semibold text-gray-900">Property Details</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Property Type</p>
                    <p className="text-sm font-medium capitalize">{deal.propertyType || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Bedrooms</p>
                    <p className="text-sm font-medium">{deal.bedrooms || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Bathrooms</p>
                    <p className="text-sm font-medium">{deal.bathrooms || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Square Feet</p>
                    <p suppressHydrationWarning className="text-sm font-medium">
                      {deal.squareFeet?.toLocaleString() || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="ds-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Asking Price</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(deal.askingPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Market Value</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(deal.marketValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Refurb Cost</p>
                    <p className="text-sm font-medium">{formatCurrency(deal.estimatedRefurbCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">After Refurb Value</p>
                    <p className="text-sm font-medium">{formatCurrency(deal.afterRefurbValue)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Investment Metrics */}
            <ToggleableMetrics>
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h2 className="text-sm font-semibold text-gray-900">Investment Metrics</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Key performance indicators for this deal</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    <KpiCard
                      label="Deal Score"
                      value={deal.dealScore !== null ? `${deal.dealScore}/100` : "—"}
                      valueType={
                        deal.dealScore !== null
                          ? deal.dealScore >= 80
                            ? "positive"
                            : deal.dealScore >= 70
                            ? "highlight"
                            : "neutral"
                          : "neutral"
                      }
                      subLabel={deal.packTier ? `${deal.packTier} tier` : undefined}
                    />
                    <KpiCard
                      label="BMV %"
                      value={deal.bmvPercentage !== null ? `${deal.bmvPercentage.toFixed(1)}%` : "—"}
                      valueType={deal.bmvPercentage !== null ? "positive" : "neutral"}
                      subLabel="Below Market Value"
                    />
                    <KpiCard
                      label="Gross Yield"
                      value={calculatedMetrics.grossYield !== null ? `${calculatedMetrics.grossYield.toFixed(1)}%` : "—"}
                      valueType="neutral"
                      subLabel="Annual rent / Price"
                    />
                    <KpiCard
                      label="Net Yield"
                      value={calculatedMetrics.netYield !== null ? `${calculatedMetrics.netYield.toFixed(1)}%` : "—"}
                      valueType="neutral"
                      subLabel="After costs (15%)"
                    />
                    <KpiCard
                      label="ROI"
                      value={calculatedMetrics.roi !== null ? `${calculatedMetrics.roi.toFixed(1)}%` : "—"}
                      valueType={calculatedMetrics.roi !== null ? "highlight" : "neutral"}
                      subLabel="Return on Investment"
                    />
                    <KpiCard
                      label="ROCE"
                      value={calculatedMetrics.roce !== null ? `${calculatedMetrics.roce.toFixed(1)}%` : "—"}
                      valueType={calculatedMetrics.roce !== null ? "highlight" : "neutral"}
                      subLabel="Return on Capital Employed"
                    />
                    <KpiCard
                      label="Cap Rate"
                      value={calculatedMetrics.capRate !== null ? `${calculatedMetrics.capRate.toFixed(2)}%` : "—"}
                      valueType="neutral"
                      subLabel="NOI / Market Value"
                    />
                    <KpiCard
                      label="GRM"
                      value={calculatedMetrics.grm !== null ? calculatedMetrics.grm.toFixed(2) : "—"}
                      valueType="neutral"
                      subLabel="Price / Annual Rent"
                    />
                  </div>
                </div>
              </div>
            </ToggleableMetrics>

            {/* Deal Score Breakdown */}
            {scoreBreakdown && (
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h2 className="text-sm font-semibold text-gray-900">Deal Score Breakdown</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Weighted factors contributing to the overall score</p>
                </div>
                <div className="p-5 space-y-4">
                  {Object.entries(scoreBreakdown).map(([key, factor]) => (
                    <div key={key} className="flex items-center justify-between gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">
                          {scoreFactorLabels[key as keyof DealScoreBreakdown] ?? key}
                        </p>
                        <p className="text-xs text-gray-400">{factor.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">
                          {factor.rawScore !== undefined ? factor.rawScore.toFixed(1) : "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          Weight {(factor.weight * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Insights */}
            {hasFinancialInsights && (
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h2 className="text-sm font-semibold text-gray-900">Financial Insights</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Cash flow, acquisition costs, and equity analysis</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Cash-on-Cash</p>
                      {calculatedMetrics.cashOnCashReturn !== null ? (
                        <>
                          <p className="text-2xl font-bold text-[#2563EB]">
                            {calculatedMetrics.cashOnCashReturn.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-400 mt-1">Annual return</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-gray-400">—</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1">Monthly Cash Flow</p>
                      {calculatedMetrics.monthlyCashFlow !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${calculatedMetrics.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                            £{fmtNum(calculatedMetrics.monthlyCashFlow)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">After expenses</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-gray-400">—</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1">Annual Cash Flow</p>
                      {calculatedMetrics.annualCashFlow !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${calculatedMetrics.annualCashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                            £{fmtNum(calculatedMetrics.annualCashFlow)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">Per year</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-gray-400">—</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1">Equity Gain</p>
                      {calculatedMetrics.equityGain !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${calculatedMetrics.equityGain >= 0 ? "text-green-600" : "text-gray-400"}`}>
                            £{fmtNum(calculatedMetrics.equityGain)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">After refurb</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-gray-400">—</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1">Payback Period</p>
                      {calculatedMetrics.paybackPeriod !== null ? (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            {calculatedMetrics.paybackPeriod.toFixed(1)}yrs
                          </p>
                          <p className="text-xs text-gray-400 mt-1">To recoup</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium text-gray-400">—</p>
                      )}
                    </div>
                  </div>

                  {/* Acquisition Cost Breakdown */}
                  {calculatedMetrics.totalAcquisitionCost !== null && (
                    <div className="pt-5 border-t border-[var(--ds-border)]">
                      <p className="text-sm font-semibold text-gray-900 mb-4">Acquisition Cost Breakdown</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Purchase Price</p>
                          <p className="font-semibold">{formatCurrency(deal.askingPrice)}</p>
                        </div>
                        {calculatedMetrics.stampDuty !== null && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Stamp Duty</p>
                            <p className="font-semibold">{formatCurrency(calculatedMetrics.stampDuty)}</p>
                          </div>
                        )}
                        {calculatedMetrics.legalFees !== null && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Legal Fees</p>
                            <p className="font-semibold">{formatCurrency(calculatedMetrics.legalFees)}</p>
                          </div>
                        )}
                        {calculatedMetrics.surveyCost !== null && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Survey</p>
                            <p className="font-semibold">{formatCurrency(calculatedMetrics.surveyCost)}</p>
                          </div>
                        )}
                        {deal.estimatedRefurbCost && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Refurb Cost</p>
                            <p className="font-semibold">{formatCurrency(deal.estimatedRefurbCost)}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-4 border-t border-[var(--ds-border)] flex justify-between items-center">
                        <p className="text-sm font-semibold text-gray-900">Total Investment Required</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(calculatedMetrics.totalAcquisitionCost)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mortgage Scenario */}
            {hasMortgage && (
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h2 className="text-sm font-semibold text-gray-900">Mortgage Scenario</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    25% deposit · 4.5% BTL interest rate · 25-year term
                  </p>
                </div>
                <div className="p-5 space-y-6">
                  {/* Upfront Costs */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-4">Upfront Investment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Deposit (25%)</p>
                        <p className="font-semibold">{formatCurrency(calculatedMetrics.mortgageDeposit)}</p>
                      </div>
                      {calculatedMetrics.stampDuty !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Stamp Duty</p>
                          <p className="font-semibold">{formatCurrency(calculatedMetrics.stampDuty)}</p>
                        </div>
                      )}
                      {calculatedMetrics.legalFees !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Legal Fees</p>
                          <p className="font-semibold">{formatCurrency(calculatedMetrics.legalFees)}</p>
                        </div>
                      )}
                      {calculatedMetrics.surveyCost !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Survey</p>
                          <p className="font-semibold">{formatCurrency(calculatedMetrics.surveyCost)}</p>
                        </div>
                      )}
                      {deal.estimatedRefurbCost && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Refurb Cost</p>
                          <p className="font-semibold">{formatCurrency(deal.estimatedRefurbCost)}</p>
                        </div>
                      )}
                    </div>
                    <div className="pt-4 border-t border-[var(--ds-border)] flex justify-between items-center">
                      <p className="text-sm font-semibold text-gray-900">Total Cash Required</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(calculatedMetrics.totalCashRequired)}
                      </p>
                    </div>
                  </div>

                  {/* Monthly Cash Flow */}
                  <div className="pt-2 border-t border-[var(--ds-border)]">
                    <p className="text-sm font-semibold text-gray-900 mb-4">Monthly Cash Flow (Mortgaged)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Monthly Mortgage</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(calculatedMetrics.monthlyMortgagePayment)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">25yr @ 4.5%</p>
                      </div>

                      {calculatedMetrics.netMonthlyCashFlowMortgaged !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Monthly Cash Flow</p>
                          <p className={`text-2xl font-bold ${calculatedMetrics.netMonthlyCashFlowMortgaged >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {formatCurrency(calculatedMetrics.netMonthlyCashFlowMortgaged)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">After mortgage & costs</p>
                        </div>
                      )}

                      {calculatedMetrics.netAnnualCashFlowMortgaged !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Annual Cash Flow</p>
                          <p className={`text-2xl font-bold ${calculatedMetrics.netAnnualCashFlowMortgaged >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {formatCurrency(calculatedMetrics.netAnnualCashFlowMortgaged)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">Per year</p>
                        </div>
                      )}

                      {calculatedMetrics.cashOnCashReturnMortgaged !== null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Cash-on-Cash Return</p>
                          <p className="text-2xl font-bold text-[#2563EB]">
                            {calculatedMetrics.cashOnCashReturnMortgaged.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-400 mt-1">On cash invested</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DCR */}
                  {calculatedMetrics.debtCoverageRatio !== null && (
                    <div className="pt-2 border-t border-[var(--ds-border)] flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">Debt Coverage Ratio (DCR)</p>
                        <p className="text-xs text-gray-400">Net Operating Income / Annual Mortgage Payment</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${
                          calculatedMetrics.debtCoverageRatio >= 1.25
                            ? "text-green-600"
                            : calculatedMetrics.debtCoverageRatio >= 1.0
                            ? "text-[#2563EB]"
                            : "text-red-500"
                        }`}>
                          {calculatedMetrics.debtCoverageRatio.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {calculatedMetrics.debtCoverageRatio >= 1.25
                            ? "Excellent (>1.25)"
                            : calculatedMetrics.debtCoverageRatio >= 1.0
                            ? "Good (>1.0)"
                            : "Low (<1.0)"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Offer Analysis */}
            <OfferAnalysisPanel
              dealId={deal.id}
              askingPrice={Number(deal.askingPrice)}
              gdv={deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null}
              estimatedRent={deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null}
              totalRefurbishment={deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null}
            />
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            {/* Deal Information */}
            <div className="ds-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                <h2 className="text-sm font-semibold text-gray-900">Deal Information</h2>
              </div>
              <div className="p-5">
                <div className="space-y-5">
                  {/* Status */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Status</p>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[deal.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {formatStatus(deal.status)}
                    </span>
                  </div>

                  {/* Data Source */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Data Source</p>
                    <p className="text-sm font-medium capitalize">{deal.dataSource || "—"}</p>
                  </div>

                  {/* Pack Tier */}
                  {deal.packTier && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Pack Tier</p>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#2563EB]">
                        {deal.packTier}
                      </span>
                    </div>
                  )}

                  {/* Pack Price */}
                  {deal.packPrice && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Pack Price</p>
                      <p className="text-base font-semibold text-[#2563EB]">
                        {formatCurrency(deal.packPrice)}
                      </p>
                    </div>
                  )}

                  {/* Agent Information */}
                  {(deal.agentName || deal.agentPhone || deal.listingUrl) && (
                    <div className="pt-4 border-t border-[var(--ds-border)]">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Agent Information</p>
                      <div className="space-y-2.5">
                        {deal.agentName && (
                          <div>
                            <p className="text-xs text-gray-400">Name</p>
                            <p className="text-sm font-medium">{deal.agentName}</p>
                          </div>
                        )}
                        {deal.agentPhone && (
                          <div>
                            <p className="text-xs text-gray-400">Phone</p>
                            <p className="text-sm font-medium">{deal.agentPhone}</p>
                          </div>
                        )}
                        {deal.listingUrl && (
                          <div>
                            <p className="text-xs text-gray-400">Listing</p>
                            <a
                              href={deal.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-[#2563EB] hover:underline break-all"
                            >
                              View Listing
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Engagement Metrics */}
                  <div className="pt-4 border-t border-[var(--ds-border)]">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Engagement</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-gray-50 border border-[var(--ds-border)] p-2.5">
                        <p className="text-xs text-gray-400 mb-1">Photos</p>
                        <p className="text-base font-bold text-[#2563EB]">{deal._count.photos}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 border border-[var(--ds-border)] p-2.5">
                        <p className="text-xs text-gray-400 mb-1">Favorites</p>
                        <p className="text-base font-bold text-amber-500">{deal._count.favorites}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 border border-[var(--ds-border)] p-2.5">
                        <p className="text-xs text-gray-400 mb-1">Views</p>
                        <p className="text-base font-bold text-gray-900">{deal._count.dealViews}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 border border-[var(--ds-border)] p-2.5">
                        <p className="text-xs text-gray-400 mb-1">Created</p>
                        <p className="text-xs font-medium text-gray-700">
                          {new Date(deal.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Team */}
                  <div className="pt-4 border-t border-[var(--ds-border)]">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Team</p>
                    <div className="space-y-3 text-sm">
                      {deal.createdBy && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Created By</p>
                          <p className="font-semibold text-gray-900">
                            {deal.createdBy.firstName} {deal.createdBy.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{deal.createdBy.email}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Assigned To</p>
                        <QuickAssignUser
                          dealId={deal.id}
                          currentAssignedToId={deal.assignedToId}
                          currentAssignedToName={
                            deal.assignedTo
                              ? `${deal.assignedTo.firstName || ""} ${deal.assignedTo.lastName || ""}`.trim() ||
                                deal.assignedTo.email
                              : null
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Location Map */}
            {((deal.latitude && deal.longitude) || deal.address) ? (
              <ToggleableMap>
                <div className="ds-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                    <h2 className="text-sm font-semibold text-gray-900">Property Location</h2>
                  </div>
                  <div className="p-0">
                    {(() => {
                      let mapUrl = ""
                      if (deal.latitude && deal.longitude) {
                        mapUrl = `https://www.google.com/maps?q=${Number(deal.latitude)},${Number(deal.longitude)}&output=embed`
                      } else {
                        const q = encodeURIComponent(
                          `${deal.address}${deal.postcode ? `, ${deal.postcode}` : ""}, UK`
                        )
                        mapUrl = `https://www.google.com/maps?q=${q}&output=embed`
                      }
                      return (
                        <div className="w-full h-[280px]">
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
                  </div>
                </div>
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

            {/* Matching Investors */}
            <MatchingInvestorsPanel
              dealId={deal.id}
              postcode={deal.postcode ?? null}
              askingPrice={Number(deal.askingPrice)}
              bmvPercentage={deal.bmvPercentage ? Number(deal.bmvPercentage) : null}
              grossYield={deal.grossYield ? Number(deal.grossYield) : null}
              recommendedStrategy={deal.recommendedStrategy ?? null}
            />

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
