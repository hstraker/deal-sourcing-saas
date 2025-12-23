/**
 * Vendor Pipeline Configuration
 * Loads configuration from environment variables with sensible defaults
 */

import { PipelineConfig, DEFAULT_PIPELINE_CONFIG } from "@/types/vendor-pipeline"

export function getPipelineConfig(): PipelineConfig {
  return {
    minBmvPercentage: parseFloat(process.env.MIN_BMV_PERCENTAGE || String(DEFAULT_PIPELINE_CONFIG.minBmvPercentage)),
    maxAskingPrice: parseFloat(process.env.MAX_ASKING_PRICE || String(DEFAULT_PIPELINE_CONFIG.maxAskingPrice)),
    minProfitPotential: parseFloat(process.env.MIN_PROFIT_POTENTIAL || String(DEFAULT_PIPELINE_CONFIG.minProfitPotential)),
    offerBasePercentage: parseFloat(process.env.OFFER_BASE_PERCENTAGE || String(DEFAULT_PIPELINE_CONFIG.offerBasePercentage)),
    offerMaxPercentage: parseFloat(process.env.OFFER_MAX_PERCENTAGE || String(DEFAULT_PIPELINE_CONFIG.offerMaxPercentage)),
    retryDelays: {
      retry1: parseInt(process.env.RETRY_1_DELAY_DAYS || String(DEFAULT_PIPELINE_CONFIG.retryDelays.retry1)),
      retry2: parseInt(process.env.RETRY_2_DELAY_DAYS || String(DEFAULT_PIPELINE_CONFIG.retryDelays.retry2)),
      retry3: parseInt(process.env.RETRY_3_DELAY_DAYS || String(DEFAULT_PIPELINE_CONFIG.retryDelays.retry3)),
    },
    maxRetries: parseInt(process.env.MAX_RETRIES || String(DEFAULT_PIPELINE_CONFIG.maxRetries)),
    conversationTimeoutHours: parseInt(process.env.CONVERSATION_TIMEOUT_HOURS || String(DEFAULT_PIPELINE_CONFIG.conversationTimeoutHours)),
    pipelinePollInterval: parseInt(process.env.PIPELINE_POLL_INTERVAL || String(DEFAULT_PIPELINE_CONFIG.pipelinePollInterval)),
  }
}

// Export environment variable names for reference
export const ENV_VARS = {
  DATABASE_URL: "DATABASE_URL",
  FACEBOOK_ACCESS_TOKEN: "FACEBOOK_ACCESS_TOKEN",
  FACEBOOK_LEAD_FORM_ID: "FACEBOOK_LEAD_FORM_ID",
  FACEBOOK_PAGE_ID: "FACEBOOK_PAGE_ID",
  TWILIO_ACCOUNT_SID: "TWILIO_ACCOUNT_SID",
  TWILIO_AUTH_TOKEN: "TWILIO_AUTH_TOKEN",
  TWILIO_PHONE_NUMBER: "TWILIO_PHONE_NUMBER",
  OPENAI_API_KEY: "OPENAI_API_KEY",
  OPENAI_MODEL: "OPENAI_MODEL",
  MIN_BMV_PERCENTAGE: "MIN_BMV_PERCENTAGE",
  MAX_ASKING_PRICE: "MAX_ASKING_PRICE",
  MIN_PROFIT_POTENTIAL: "MIN_PROFIT_POTENTIAL",
  OFFER_BASE_PERCENTAGE: "OFFER_BASE_PERCENTAGE",
  OFFER_MAX_PERCENTAGE: "OFFER_MAX_PERCENTAGE",
  RETRY_1_DELAY_DAYS: "RETRY_1_DELAY_DAYS",
  RETRY_2_DELAY_DAYS: "RETRY_2_DELAY_DAYS",
  RETRY_3_DELAY_DAYS: "RETRY_3_DELAY_DAYS",
  MAX_RETRIES: "MAX_RETRIES",
  CONVERSATION_TIMEOUT_HOURS: "CONVERSATION_TIMEOUT_HOURS",
  PIPELINE_POLL_INTERVAL: "PIPELINE_POLL_INTERVAL",
} as const

