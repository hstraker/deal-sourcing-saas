/**
 * TypeScript types and interfaces for the Vendor Pipeline system
 */

import { PipelineStage, UrgencyLevel, PropertyCondition, ReasonForSale, SMSDirection, SMSStatus } from "@prisma/client"

// ============================================================================
// Pipeline Stage Types
// ============================================================================

export type VendorPipelineStage = PipelineStage

export const PIPELINE_STAGES = {
  NEW_LEAD: "NEW_LEAD",
  AI_CONVERSATION: "AI_CONVERSATION",
  DEAL_VALIDATION: "DEAL_VALIDATION",
  OFFER_MADE: "OFFER_MADE",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  OFFER_REJECTED: "OFFER_REJECTED",
  VIDEO_SENT: "VIDEO_SENT",
  RETRY_1: "RETRY_1",
  RETRY_2: "RETRY_2",
  RETRY_3: "RETRY_3",
  PAPERWORK_SENT: "PAPERWORK_SENT",
  READY_FOR_INVESTORS: "READY_FOR_INVESTORS",
  DEAD_LEAD: "DEAD_LEAD",
} as const

// ============================================================================
// Vendor Lead Types
// ============================================================================

export interface VendorLeadInput {
  facebookLeadId?: string
  leadSource?: string
  campaignId?: string
  vendorName: string
  vendorPhone: string
  vendorEmail?: string
  vendorAddress?: string
  propertyAddress?: string
  propertyPostcode?: string
  askingPrice?: number
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  condition?: PropertyCondition
}

export interface VendorLeadUpdate {
  pipelineStage?: PipelineStage
  conversationState?: Record<string, any>
  motivationScore?: number
  urgencyLevel?: UrgencyLevel
  reasonForSelling?: ReasonForSale
  timelineDays?: number
  competingOffers?: boolean
  bmvScore?: number
  estimatedMarketValue?: number
  estimatedRefurbCost?: number
  profitPotential?: number
  validationPassed?: boolean
  validationNotes?: string
  offerAmount?: number
  offerPercentage?: number
  rejectionReason?: string
  retryCount?: number
  nextRetryAt?: Date
  videoSent?: boolean
  videoUrl?: string
  solicitorName?: string
  solicitorFirm?: string
  solicitorPhone?: string
  solicitorEmail?: string
  lockoutAgreementSent?: boolean
  lockoutAgreementSigned?: boolean
  dealId?: string
}

export interface ConversationState {
  extractedData?: {
    propertyAddress?: string
    askingPrice?: number
    condition?: PropertyCondition
    reasonForSelling?: ReasonForSale
    timeline?: UrgencyLevel
    timelineDays?: number
    competingOffers?: boolean
  }
  conversationFlow?: "initial" | "extracting_details" | "offer_pending" | "retry"
  lastQuestionAsked?: string
  messagesExchanged?: number
  conversationComplete?: boolean
}

// ============================================================================
// SMS Message Types
// ============================================================================

export interface SMSMessageInput {
  vendorLeadId: string
  direction: SMSDirection
  messageSid?: string
  fromNumber?: string
  toNumber?: string
  messageBody: string
  aiGenerated?: boolean
  aiPrompt?: string
  aiResponseMetadata?: Record<string, any>
  intentDetected?: string
  confidenceScore?: number
  status?: SMSStatus
  errorCode?: string
  errorMessage?: string
}

export interface AIConversationMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: Date
}

export interface AIConversationContext {
  vendorName: string
  propertyAddress?: string
  conversationHistory: AIConversationMessage[]
  extractedData: ConversationState["extractedData"]
  motivationScore?: number
}

// ============================================================================
// Deal Validation Types
// ============================================================================

export interface DealValidationInput {
  vendorLeadId: string
  propertyAddress: string
  postcode?: string
  askingPrice: number
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  condition?: PropertyCondition
}

export interface DealValidationResult {
  passed: boolean
  bmvScore: number | null
  estimatedMarketValue: number | null
  estimatedRefurbCost: number | null
  profitPotential: number | null
  validationNotes: string
  reasons?: string[]
}

// ============================================================================
// Offer Calculation Types
// ============================================================================

export interface OfferCalculationInput {
  askingPrice: number
  marketValue: number
  condition?: PropertyCondition
  motivationScore?: number
  estimatedRefurbCost?: number
}

export interface OfferCalculationResult {
  offerAmount: number
  offerPercentage: number // % of asking price
  offerPercentageOfMarket: number // % of market value
  calculationBreakdown: {
    baseOffer: number // 80% of market value
    conditionAdjustment: number // -renovation costs
    motivationBonus: number // Based on motivation score
    finalOffer: number
  }
}

// ============================================================================
// Facebook Lead Types
// ============================================================================

export interface FacebookLeadData {
  id: string
  created_time: string
  field_data: Array<{
    name: string
    values: string[]
  }>
}

export interface FacebookLeadParsed {
  facebookLeadId: string
  vendorName: string
  vendorPhone: string
  vendorEmail?: string
  propertyAddress?: string
  askingPrice?: number
  campaignId?: string
  formId?: string
  pageId?: string
}

// ============================================================================
// Pipeline Metrics Types
// ============================================================================

export interface PipelineMetricsInput {
  date: Date
  newLeads?: number
  inConversation?: number
  validated?: number
  offersMade?: number
  offersAccepted?: number
  offersRejected?: number
  dealsClosed?: number
  deadLeads?: number
  conversationToOfferRate?: number
  offerAcceptanceRate?: number
  overallConversionRate?: number
  avgConversationDurationHours?: number
  avgTimeToOfferHours?: number
  avgTimeToCloseDays?: number
  totalOfferValue?: number
  totalAcceptedValue?: number
  avgBmvPercentage?: number
  totalProfitPotential?: number
  avgMotivationScore?: number
  avgMessagesPerConversation?: number
  aiResponseTimeMs?: number
}

export interface PipelineStats {
  totalLeads: number
  byStage: Record<PipelineStage, number>
  conversionRates: {
    leadToOffer: number
    offerToAcceptance: number
    overall: number
  }
  avgTimes: {
    conversationDurationHours: number
    timeToOfferHours: number
    timeToCloseDays: number
  }
  financial: {
    totalOffersMade: number
    totalAcceptedValue: number
    avgBmvPercentage: number
  }
}

// ============================================================================
// Pipeline Event Types
// ============================================================================

export interface PipelineEventInput {
  vendorLeadId: string
  eventType: string
  fromStage?: PipelineStage
  toStage?: PipelineStage
  details?: Record<string, any>
  createdBy?: string
}

// ============================================================================
// Retry Management Types
// ============================================================================

export interface RetrySchedule {
  retryNumber: 1 | 2 | 3
  delayDays: number
  messageTemplate?: string
}

export const RETRY_SCHEDULE: Record<1 | 2 | 3, RetrySchedule> = {
  1: {
    retryNumber: 1,
    delayDays: 2,
    messageTemplate: "Hi {name}, just checking if you've had time to consider our offer of £{offerAmount} for {address}? We can complete quickly with no chain.",
  },
  2: {
    retryNumber: 2,
    delayDays: 4,
    messageTemplate: "Hi {name}, we can be flexible on price/timeline. Would £{adjustedOffer} work better for you? Let me know your thoughts.",
  },
  3: {
    retryNumber: 3,
    delayDays: 7,
    messageTemplate: "Hi {name}, this is our final offer of £{offerAmount}. We have other opportunities, so please let us know by {deadline} if you're interested.",
  },
}

// ============================================================================
// API Response Types
// ============================================================================

export interface VendorLeadResponse {
  id: string
  facebookLeadId?: string
  vendorName: string
  vendorPhone: string
  vendorEmail?: string
  propertyAddress?: string
  askingPrice?: number
  pipelineStage: PipelineStage
  motivationScore?: number
  bmvScore?: number
  offerAmount?: number
  createdAt: Date
  updatedAt: Date
  lastContactAt?: Date
  conversation?: SMSMessageResponse[]
  validation?: DealValidationResult
  offer?: {
    amount: number
    percentage: number
    sentAt?: Date
    status: "pending" | "accepted" | "rejected"
  }
}

export interface SMSMessageResponse {
  id: string
  direction: SMSDirection
  messageBody: string
  aiGenerated: boolean
  status?: SMSStatus
  sentAt: Date
  deliveredAt?: Date
}

export interface PipelineStatsResponse {
  stats: PipelineStats
  recentLeads: VendorLeadResponse[]
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PipelineConfig {
  minBmvPercentage: number // Default: 15
  maxAskingPrice: number // Default: 500000
  minProfitPotential: number // Default: 30000
  offerBasePercentage: number // Default: 80 (80% of market value)
  offerMaxPercentage: number // Default: 85 (never more than 85% of asking)
  retryDelays: {
    retry1: number // days
    retry2: number // days
    retry3: number // days
  }
  maxRetries: number // Default: 3
  conversationTimeoutHours: number // Default: 48
  pipelinePollInterval: number // seconds, Default: 60
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  minBmvPercentage: 15.0,
  maxAskingPrice: 500000,
  minProfitPotential: 30000,
  offerBasePercentage: 80,
  offerMaxPercentage: 85,
  retryDelays: {
    retry1: 2,
    retry2: 4,
    retry3: 7,
  },
  maxRetries: 3,
  conversationTimeoutHours: 48,
  pipelinePollInterval: 60,
}

// ============================================================================
// Helper Functions
// ============================================================================

export function isValidStageTransition(from: PipelineStage, to: PipelineStage): boolean {
  const validTransitions: Record<PipelineStage, PipelineStage[]> = {
    NEW_LEAD: [PipelineStage.AI_CONVERSATION],
    AI_CONVERSATION: [PipelineStage.DEAL_VALIDATION, PipelineStage.DEAD_LEAD],
    DEAL_VALIDATION: [PipelineStage.OFFER_MADE, PipelineStage.DEAD_LEAD],
    OFFER_MADE: [PipelineStage.OFFER_ACCEPTED, PipelineStage.OFFER_REJECTED],
    OFFER_ACCEPTED: [PipelineStage.PAPERWORK_SENT, PipelineStage.READY_FOR_INVESTORS],
    OFFER_REJECTED: [PipelineStage.VIDEO_SENT, PipelineStage.DEAD_LEAD],
    VIDEO_SENT: [PipelineStage.RETRY_1, PipelineStage.DEAD_LEAD],
    RETRY_1: [PipelineStage.OFFER_ACCEPTED, PipelineStage.RETRY_2, PipelineStage.DEAD_LEAD],
    RETRY_2: [PipelineStage.OFFER_ACCEPTED, PipelineStage.RETRY_3, PipelineStage.DEAD_LEAD],
    RETRY_3: [PipelineStage.OFFER_ACCEPTED, PipelineStage.DEAD_LEAD],
    PAPERWORK_SENT: [PipelineStage.READY_FOR_INVESTORS],
    READY_FOR_INVESTORS: [],
    DEAD_LEAD: [],
  }

  return validTransitions[from]?.includes(to) ?? false
}

export function getRetryDelayDays(retryCount: number): number | null {
  switch (retryCount) {
    case 0:
      return 2 // First retry after 2 days
    case 1:
      return 4 // Second retry after 4 days
    case 2:
      return 7 // Third retry after 7 days
    default:
      return null // No more retries
  }
}

