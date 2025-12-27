/**
 * Deal Validator for Vendor Pipeline
 * Wraps existing BMV/deal scoring logic to validate vendor properties
 */

import { prisma } from "@/lib/db"
import { calculateBMVPercentage } from "@/lib/calculations/deal-metrics"
import { calculateDealScore } from "@/lib/deal-scoring"
import { fetchPropertyValuation } from "@/lib/propertydata"
import { DealValidationInput, DealValidationResult } from "@/types/vendor-pipeline"
import { PropertyCondition } from "@prisma/client"
import { getPipelineConfig } from "./config"

export class DealValidator {
  private config = getPipelineConfig()

  /**
   * Validate a vendor deal
   */
  async validateDeal(vendorLeadId: string): Promise<DealValidationResult> {
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      throw new Error(`Vendor lead ${vendorLeadId} not found`)
    }

    if (!lead.propertyAddress || !lead.askingPrice) {
      return {
        passed: false,
        bmvScore: null,
        estimatedMarketValue: null,
        estimatedRefurbCost: null,
        profitPotential: null,
        validationNotes: "Missing required property details (address or asking price)",
        reasons: ["Missing property address or asking price"],
      }
    }

    const input: DealValidationInput = {
      vendorLeadId,
      propertyAddress: lead.propertyAddress,
      postcode: lead.propertyPostcode || undefined,
      askingPrice: Number(lead.askingPrice),
      propertyType: lead.propertyType || undefined,
      bedrooms: lead.bedrooms || undefined,
      bathrooms: lead.bathrooms || undefined,
      condition: lead.condition || undefined,
    }

    return this.validateProperty(input)
  }

  /**
   * Validate property details
   */
  private async validateProperty(input: DealValidationInput): Promise<DealValidationResult> {
    const reasons: string[] = []
    let estimatedMarketValue: number | null = null
    let estimatedRefurbCost: number | null = null
    let bmvScore: number | null = null

    try {
      // 1. Get market value from PropertyData API
      try {
        if (input.postcode) {
          // Estimate internal area based on bedrooms if not provided
          const bedrooms = input.bedrooms || 3
          const estimatedInternalArea = bedrooms * 50 // Rough estimate: 50 sqm per bedroom

          const valuationData = await fetchPropertyValuation(
            input.postcode,
            input.propertyType || "house",
            estimatedInternalArea,
            bedrooms,
            input.bathrooms || 1
          )

          if (valuationData?.estimate) {
            estimatedMarketValue = valuationData.estimate
          }
        }
      } catch (error) {
        console.error("Error fetching property valuation:", error)
        reasons.push("Could not fetch market value data")
      }

      // 2. Calculate BMV percentage
      if (estimatedMarketValue && input.askingPrice) {
        bmvScore = calculateBMVPercentage(input.askingPrice, estimatedMarketValue)
        
        if (!bmvScore || bmvScore < this.config.minBmvPercentage) {
          reasons.push(
            `BMV ${bmvScore?.toFixed(1) || 0}% is below minimum threshold of ${this.config.minBmvPercentage}%`
          )
        }
      } else {
        reasons.push("Unable to calculate BMV - market value unavailable")
      }

      // 3. Estimate refurbishment costs based on condition
      estimatedRefurbCost = this.estimateRefurbCost(
        input.condition,
        input.propertyType,
        input.bedrooms
      )

      // 4. Calculate profit potential
      let profitPotential: number | null = null
      if (estimatedMarketValue && input.askingPrice && estimatedRefurbCost) {
        // Profit = Market Value - (Asking Price + Refurb Cost + Fees)
        // Fees estimated at 5% of asking price (legal, surveys, etc.)
        const fees = input.askingPrice * 0.05
        profitPotential = estimatedMarketValue - (input.askingPrice + estimatedRefurbCost + fees)
        
        if (profitPotential < this.config.minProfitPotential) {
          reasons.push(
            `Profit potential £${profitPotential.toFixed(0)} is below minimum threshold of £${this.config.minProfitPotential}`
          )
        }
      }

      // 5. Check asking price limit
      if (input.askingPrice > this.config.maxAskingPrice) {
        reasons.push(
          `Asking price £${input.askingPrice.toLocaleString()} exceeds maximum of £${this.config.maxAskingPrice.toLocaleString()}`
        )
      }

      // 6. Validate property type (exclude land, commercial)
      if (input.propertyType) {
        const invalidTypes = ["land", "commercial", "parking"]
        if (invalidTypes.includes(input.propertyType.toLowerCase())) {
          reasons.push(`Property type ${input.propertyType} is not acceptable`)
        }
      }

      // Determine if passed
      const passed = reasons.length === 0

      return {
        passed,
        bmvScore: bmvScore || null,
        estimatedMarketValue,
        estimatedRefurbCost,
        profitPotential,
        validationNotes: passed
          ? "Deal validated successfully"
          : reasons.join("; "),
        reasons: reasons.length > 0 ? reasons : undefined,
      }
    } catch (error: any) {
      console.error("Error validating deal:", error)
      return {
        passed: false,
        bmvScore: null,
        estimatedMarketValue: null,
        estimatedRefurbCost: null,
        profitPotential: null,
        validationNotes: `Validation error: ${error.message}`,
        reasons: [error.message],
      }
    }
  }

  /**
   * Estimate refurbishment costs based on property condition
   */
  private estimateRefurbCost(
    condition?: PropertyCondition,
    propertyType?: string,
    bedrooms?: number
  ): number {
    // Base costs by condition
    const baseCosts: Record<PropertyCondition, number> = {
      [PropertyCondition.excellent]: 0,
      [PropertyCondition.good]: 5000,
      [PropertyCondition.needs_work]: 15000,
      [PropertyCondition.needs_modernisation]: 25000,
      [PropertyCondition.poor]: 40000,
    }

    const baseCost = condition ? baseCosts[condition] : 20000 // Default if unknown

    // Adjust for property size (bedrooms)
    let multiplier = 1.0
    if (bedrooms) {
      if (bedrooms <= 1) {
        multiplier = 0.7
      } else if (bedrooms >= 4) {
        multiplier = 1.3
      } else if (bedrooms >= 3) {
        multiplier = 1.15
      }
    }

    // Adjust for property type
    if (propertyType) {
      const type = propertyType.toLowerCase()
      if (type === "flat" || type === "apartment") {
        multiplier *= 0.9
      } else if (type === "detached") {
        multiplier *= 1.1
      }
    }

    return Math.round(baseCost * multiplier)
  }
}

export const dealValidator = new DealValidator()

