"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateAllMetrics, type DealCalculationInput } from "@/lib/calculations/deal-metrics"

interface DealMetricsPreviewProps {
  askingPrice: number | null
  marketValue: number | null | undefined
  estimatedRefurbCost: number | null | undefined
  afterRefurbValue: number | null | undefined
  estimatedMonthlyRent: number | null | undefined
  bedrooms: number | null | undefined
  propertyType: string | null | undefined
  postcode: string | null | undefined
}

export function DealMetricsPreview({
  askingPrice,
  marketValue,
  estimatedRefurbCost,
  afterRefurbValue,
  estimatedMonthlyRent,
  bedrooms,
  propertyType,
  postcode,
}: DealMetricsPreviewProps) {
  const [metrics, setMetrics] = useState<ReturnType<typeof calculateAllMetrics> | null>(null)

  useEffect(() => {
    if (!askingPrice || askingPrice <= 0) {
      setMetrics(null)
      return
    }

    const input: DealCalculationInput = {
      askingPrice,
      marketValue: marketValue ?? null,
      estimatedRefurbCost: estimatedRefurbCost ?? null,
      afterRefurbValue: afterRefurbValue ?? null,
      estimatedMonthlyRent: estimatedMonthlyRent ?? null,
      bedrooms: bedrooms ?? null,
      propertyType: propertyType ?? null,
      postcode: postcode ?? null,
    }

    const calculated = calculateAllMetrics(input)
    setMetrics(calculated)
  }, [
    askingPrice,
    marketValue,
    estimatedRefurbCost,
    afterRefurbValue,
    estimatedMonthlyRent,
    bedrooms,
    propertyType,
    postcode,
  ])

  if (!metrics || !askingPrice) {
    return null
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle>Calculated Metrics</CardTitle>
        <CardDescription>
          These metrics are automatically calculated and will be saved with your deal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* BMV % */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">BMV %</p>
            {metrics.bmvPercentage !== null ? (
              <>
                <p className="text-2xl font-bold text-success">
                  {metrics.bmvPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Below Market Value</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need market value</p>
              </>
            )}
          </div>

          {/* Gross Yield */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Gross Yield</p>
            {metrics.grossYield !== null ? (
              <>
                <p className="text-2xl font-bold">
                  {metrics.grossYield.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Annual rent / Price</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need monthly rent</p>
              </>
            )}
          </div>

          {/* Net Yield */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Net Yield</p>
            {metrics.netYield !== null ? (
              <>
                <p className="text-2xl font-bold">
                  {metrics.netYield.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">After costs (15%)</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need monthly rent</p>
              </>
            )}
          </div>

          {/* Cap Rate */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cap Rate</p>
            {metrics.capRate !== null ? (
              <>
                <p className="text-2xl font-bold">
                  {metrics.capRate.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">NOI / Market Value</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need market value & rent</p>
              </>
            )}
          </div>

          {/* GRM */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">GRM</p>
            {metrics.grm !== null ? (
              <>
                <p className="text-2xl font-bold">
                  {metrics.grm.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Price / Annual Rent</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need monthly rent</p>
              </>
            )}
          </div>

          {/* ROI */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">ROI</p>
            {metrics.roi !== null ? (
              <>
                <p className="text-2xl font-bold text-primary">
                  {metrics.roi.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Return on Investment</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need rent & refurb cost</p>
              </>
            )}
          </div>

          {/* ROCE */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">ROCE</p>
            {metrics.roce !== null ? (
              <>
                <p className="text-2xl font-bold text-primary">
                  {metrics.roce.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Return on Capital Employed</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need rent & after refurb value</p>
              </>
            )}
          </div>

          {/* Deal Score */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Deal Score</p>
            {metrics.dealScore !== null ? (
              <>
                <p className={`text-2xl font-bold ${
                  metrics.dealScore >= 80 ? "text-success" :
                  metrics.dealScore >= 70 ? "text-primary" :
                  "text-muted-foreground"
                }`}>
                  {metrics.dealScore}/100
                </p>
                {metrics.packTier && (
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {metrics.packTier} pack
                  </p>
                )}
                {!metrics.packTier && (
                  <p className="text-xs text-muted-foreground mt-1">Score too low</p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Need more data</p>
              </>
            )}
          </div>
        </div>

        {/* Financial Insights Section */}
        {(metrics.monthlyCashFlow !== null || metrics.cashOnCashReturn !== null || metrics.totalAcquisitionCost !== null) && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold mb-4">Financial Insights</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Cash-on-Cash Return */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cash-on-Cash</p>
                {metrics.cashOnCashReturn !== null ? (
                  <>
                    <p className="text-xl font-bold text-primary">
                      {metrics.cashOnCashReturn.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Annual return</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                )}
              </div>

              {/* Monthly Cash Flow */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monthly Cash Flow</p>
                {metrics.monthlyCashFlow !== null ? (
                  <>
                    <p className={`text-xl font-bold ${metrics.monthlyCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                      £{metrics.monthlyCashFlow.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">After expenses</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                )}
              </div>

              {/* Annual Cash Flow */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Annual Cash Flow</p>
                {metrics.annualCashFlow !== null ? (
                  <>
                    <p className={`text-xl font-bold ${metrics.annualCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                      £{metrics.annualCashFlow.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Per year</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                )}
              </div>

              {/* Equity Gain */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Equity Gain</p>
                {metrics.equityGain !== null ? (
                  <>
                    <p className={`text-xl font-bold ${metrics.equityGain >= 0 ? "text-success" : "text-muted-foreground"}`}>
                      £{metrics.equityGain.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">After refurb</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                )}
              </div>

              {/* Payback Period */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Payback Period</p>
                {metrics.paybackPeriod !== null ? (
                  <>
                    <p className="text-xl font-bold">
                      {metrics.paybackPeriod.toFixed(1)}yrs
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">To recoup</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                )}
              </div>
            </div>

            {/* Acquisition Cost Breakdown */}
            {metrics.totalAcquisitionCost !== null && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium mb-2">Total Acquisition Cost Breakdown</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Purchase Price</p>
                    <p className="font-medium">£{askingPrice.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  </div>
                  {metrics.stampDuty !== null && (
                    <div>
                      <p className="text-muted-foreground">Stamp Duty</p>
                      <p className="font-medium">£{metrics.stampDuty.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                  )}
                  {metrics.legalFees !== null && (
                    <div>
                      <p className="text-muted-foreground">Legal Fees</p>
                      <p className="font-medium">£{metrics.legalFees.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                  )}
                  {metrics.surveyCost !== null && (
                    <div>
                      <p className="text-muted-foreground">Survey</p>
                      <p className="font-medium">£{metrics.surveyCost.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                  )}
                  {estimatedRefurbCost && (
                    <div>
                      <p className="text-muted-foreground">Refurb Cost</p>
                      <p className="font-medium">£{estimatedRefurbCost.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold">Total Investment Required</p>
                    <p className="text-lg font-bold">
                      £{metrics.totalAcquisitionCost.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mortgage Scenario Section */}
        {metrics.monthlyMortgagePayment !== null && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold mb-4">Mortgage Scenario (25% Deposit, 4.5% BTL Rate)</h4>
            <div className="space-y-4">
              {/* Upfront Costs */}
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">Upfront Investment</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">Deposit (25%)</p>
                    <p className="font-semibold">
                      {metrics.mortgageDeposit ? `£${metrics.mortgageDeposit.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                    </p>
                  </div>
                  {metrics.stampDuty !== null && (
                    <div>
                      <p className="text-muted-foreground mb-1">Stamp Duty</p>
                      <p className="font-semibold">
                        £{metrics.stampDuty.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                  {metrics.legalFees !== null && (
                    <div>
                      <p className="text-muted-foreground mb-1">Legal Fees</p>
                      <p className="font-semibold">
                        £{metrics.legalFees.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                  {estimatedRefurbCost && (
                    <div>
                      <p className="text-muted-foreground mb-1">Refurb Cost</p>
                      <p className="font-semibold">
                        £{estimatedRefurbCost.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                  {metrics.totalCashRequired !== null && (
                    <div>
                      <p className="text-muted-foreground mb-1">Total Cash Required</p>
                      <p className="font-bold text-lg">
                        £{metrics.totalCashRequired.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mortgage & Cash Flow Metrics */}
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">Monthly Cash Flow (Mortgaged)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Monthly Mortgage Payment */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mortgage Payment</p>
                    <p className="text-xl font-bold">
                      £{metrics.monthlyMortgagePayment.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Per month (25yr @ 4.5%)</p>
                  </div>

                  {/* Monthly Cash Flow (Mortgaged) */}
                  {metrics.netMonthlyCashFlowMortgaged !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly Cash Flow</p>
                      <p className={`text-xl font-bold ${metrics.netMonthlyCashFlowMortgaged >= 0 ? 'text-success' : 'text-destructive'}`}>
                        £{metrics.netMonthlyCashFlowMortgaged.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">After mortgage & costs</p>
                    </div>
                  )}

                  {/* Annual Cash Flow (Mortgaged) */}
                  {metrics.netAnnualCashFlowMortgaged !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Annual Cash Flow</p>
                      <p className={`text-xl font-bold ${metrics.netAnnualCashFlowMortgaged >= 0 ? 'text-success' : 'text-destructive'}`}>
                        £{metrics.netAnnualCashFlowMortgaged.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Per year</p>
                    </div>
                  )}

                  {/* Cash-on-Cash Return (Mortgaged) */}
                  {metrics.cashOnCashReturnMortgaged !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cash-on-Cash Return</p>
                      <p className="text-xl font-bold text-primary">
                        {metrics.cashOnCashReturnMortgaged.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Based on cash invested</p>
                    </div>
                  )}
                </div>
              </div>

              {/* DCR */}
              {metrics.debtCoverageRatio !== null && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Debt Coverage Ratio (DCR)</p>
                      <p className="text-xs text-muted-foreground">NOI / Annual Mortgage Payment</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${metrics.debtCoverageRatio >= 1.25 ? 'text-success' : metrics.debtCoverageRatio >= 1.0 ? 'text-primary' : 'text-destructive'}`}>
                        {metrics.debtCoverageRatio.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.debtCoverageRatio >= 1.25 ? 'Excellent (>1.25)' : 
                         metrics.debtCoverageRatio >= 1.0 ? 'Good (>1.0)' : 
                         'Low (<1.0)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium mb-2">
            Metric Requirements:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {!marketValue && (
              <li>• <strong>BMV%:</strong> Add Market Value (30% of deal score)</li>
            )}
            {!estimatedMonthlyRent && (
              <li>• <strong>Yields, ROI, Cash Flow:</strong> Add Estimated Monthly Rent (25% of deal score)</li>
            )}
            {estimatedMonthlyRent && !estimatedRefurbCost && (
              <li>• <strong>ROI:</strong> Add Estimated Refurb Cost for accurate ROI</li>
            )}
            {estimatedMonthlyRent && !afterRefurbValue && (
              <li>• <strong>ROCE, Equity Gain:</strong> Add After Refurb Value</li>
            )}
            {postcode && !["SA", "CF", "NP", "LL"].includes(postcode.substring(0, 2).toUpperCase()) && (
              <li>• <strong>Location:</strong> Target areas (SA, CF, NP, LL) score higher (15% of score)</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

