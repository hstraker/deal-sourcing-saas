-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('contacted', 'validated', 'offer_made', 'offer_accepted', 'offer_rejected', 'negotiating', 'locked_out', 'withdrawn');

-- CreateEnum
CREATE TYPE "ConversationDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'more_info_sent', 'accepted', 'rejected', 'counter_offered', 'expired', 'withdrawn');

-- CreateEnum
CREATE TYPE "VendorDecision" AS ENUM ('accepted', 'rejected', 'more_info_requested', 'counter_offer');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('pending', 'fee_pending', 'proof_of_funds_pending', 'verified', 'locked_out', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW_LEAD', 'AI_CONVERSATION', 'DEAL_VALIDATION', 'OFFER_MADE', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'VIDEO_SENT', 'RETRY_1', 'RETRY_2', 'RETRY_3', 'PAPERWORK_SENT', 'READY_FOR_INVESTORS', 'DEAD_LEAD');

-- CreateEnum
CREATE TYPE "SMSDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "SMSStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'undelivered');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('urgent', 'quick', 'moderate', 'flexible');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('excellent', 'good', 'needs_work', 'needs_modernisation', 'poor');

-- CreateEnum
CREATE TYPE "ReasonForSale" AS ENUM ('relocation', 'financial', 'divorce', 'inheritance', 'downsize', 'other');

-- AlterTable
ALTER TABLE "communications" ADD COLUMN     "sms_direction" TEXT,
ADD COLUMN     "sms_message_id" TEXT,
ADD COLUMN     "sms_provider" TEXT,
ADD COLUMN     "vendor_id" TEXT,
ALTER COLUMN "investor_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "estimated_monthly_rent" DECIMAL(10,2),
ADD COLUMN     "investor_pack_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "investor_pack_sent_at" TIMESTAMP(3),
ADD COLUMN     "investor_pack_sent_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "latest_offer_amount" DECIMAL(10,2),
ADD COLUMN     "latest_offer_date" TIMESTAMP(3),
ADD COLUMN     "lock_out_agreement_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lock_out_agreement_sent_at" TIMESTAMP(3),
ADD COLUMN     "offer_accepted_at" TIMESTAMP(3),
ADD COLUMN     "offer_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservations_with_proof_of_funds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendor_solicitor_email" TEXT,
ADD COLUMN     "vendor_solicitor_name" TEXT,
ADD COLUMN     "vendor_solicitor_phone" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_picture_s3_key" TEXT,
ADD COLUMN     "reset_password_token" TEXT,
ADD COLUMN     "reset_password_token_expires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "property_data_cache" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "data" JSONB NOT NULL,
    "credits_used" INTEGER NOT NULL DEFAULT 1,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_data_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "source" TEXT NOT NULL DEFAULT 'facebook_ad',
    "facebook_ad_id" TEXT,
    "campaign_id" TEXT,
    "asking_price" DECIMAL(10,2),
    "property_address" TEXT,
    "reason_for_sale" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'contacted',
    "qualified_at" TIMESTAMP(3),
    "locked_out_at" TIMESTAMP(3),
    "solicitor_name" TEXT,
    "solicitor_email" TEXT,
    "solicitor_phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_ai_conversations" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "direction" "ConversationDirection" NOT NULL,
    "message" TEXT NOT NULL,
    "ai_response" TEXT,
    "intent" TEXT,
    "confidence" DECIMAL(5,2),
    "video_sent" BOOLEAN NOT NULL DEFAULT false,
    "video_url" TEXT,
    "message_id" TEXT,
    "provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_offers" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "offer_amount" DECIMAL(10,2) NOT NULL,
    "offer_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "vendorDecision" "VendorDecision",
    "vendor_decision_date" TIMESTAMP(3),
    "vendor_notes" TEXT,
    "more_info_requested" BOOLEAN NOT NULL DEFAULT false,
    "video_sent" BOOLEAN NOT NULL DEFAULT false,
    "counter_offer_amount" DECIMAL(10,2),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_reservations" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "reservation_fee" DECIMAL(10,2) NOT NULL,
    "fee_paid" BOOLEAN NOT NULL DEFAULT false,
    "fee_payment_id" TEXT,
    "fee_paid_at" TIMESTAMP(3),
    "proof_of_funds_provided" BOOLEAN NOT NULL DEFAULT false,
    "proof_of_funds_document_s3_key" TEXT,
    "proof_of_funds_verified" BOOLEAN NOT NULL DEFAULT false,
    "proof_of_funds_verified_at" TIMESTAMP(3),
    "proof_of_funds_verified_by" TEXT,
    "solicitor_name" TEXT,
    "solicitor_email" TEXT,
    "solicitor_phone" TEXT,
    "solicitor_firm" TEXT,
    "lock_out_agreement_sent" BOOLEAN NOT NULL DEFAULT false,
    "lock_out_agreement_sent_at" TIMESTAMP(3),
    "lock_out_agreement_signed" BOOLEAN NOT NULL DEFAULT false,
    "lock_out_agreement_signed_at" TIMESTAMP(3),
    "lock_out_agreement_document_s3_key" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "investor_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_leads" (
    "id" TEXT NOT NULL,
    "facebook_lead_id" TEXT,
    "lead_source" TEXT NOT NULL DEFAULT 'facebook_ads',
    "campaign_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "vendor_phone" TEXT NOT NULL,
    "vendor_email" TEXT,
    "vendor_address" TEXT,
    "property_address" TEXT,
    "property_postcode" TEXT,
    "asking_price" DECIMAL(12,2),
    "property_type" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "condition" "PropertyCondition",
    "pipeline_stage" "PipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "conversation_state" JSONB DEFAULT '{}',
    "ai_conversation_history" JSONB DEFAULT '[]',
    "motivation_score" INTEGER,
    "urgency_level" "UrgencyLevel",
    "reason_for_selling" "ReasonForSale",
    "timeline_days" INTEGER,
    "competing_offers" BOOLEAN NOT NULL DEFAULT false,
    "bmv_score" DECIMAL(5,2),
    "estimated_market_value" DECIMAL(12,2),
    "estimated_refurb_cost" DECIMAL(12,2),
    "profit_potential" DECIMAL(12,2),
    "validation_passed" BOOLEAN,
    "validation_notes" TEXT,
    "validated_at" TIMESTAMP(3),
    "offer_amount" DECIMAL(12,2),
    "offer_percentage" DECIMAL(5,2),
    "offer_sent_at" TIMESTAMP(3),
    "offer_accepted_at" TIMESTAMP(3),
    "offer_rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "video_sent" BOOLEAN NOT NULL DEFAULT false,
    "video_sent_at" TIMESTAMP(3),
    "video_url" TEXT,
    "solicitor_name" TEXT,
    "solicitor_firm" TEXT,
    "solicitor_phone" TEXT,
    "solicitor_email" TEXT,
    "lockout_agreement_sent" BOOLEAN NOT NULL DEFAULT false,
    "lockout_agreement_sent_at" TIMESTAMP(3),
    "lockout_agreement_signed" BOOLEAN NOT NULL DEFAULT false,
    "lockout_agreement_signed_at" TIMESTAMP(3),
    "lockout_agreement_s3_key" TEXT,
    "deal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_contact_at" TIMESTAMP(3),
    "conversation_started_at" TIMESTAMP(3),
    "deal_closed_at" TIMESTAMP(3),

    CONSTRAINT "vendor_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "vendor_lead_id" TEXT NOT NULL,
    "direction" "SMSDirection" NOT NULL,
    "message_sid" TEXT,
    "from_number" TEXT,
    "to_number" TEXT,
    "message_body" TEXT NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_prompt" TEXT,
    "ai_response_metadata" JSONB,
    "intent_detected" TEXT,
    "confidence_score" DECIMAL(5,2),
    "status" "SMSStatus",
    "error_code" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "new_leads" INTEGER NOT NULL DEFAULT 0,
    "in_conversation" INTEGER NOT NULL DEFAULT 0,
    "validated" INTEGER NOT NULL DEFAULT 0,
    "offers_made" INTEGER NOT NULL DEFAULT 0,
    "offers_accepted" INTEGER NOT NULL DEFAULT 0,
    "offers_rejected" INTEGER NOT NULL DEFAULT 0,
    "deals_closed" INTEGER NOT NULL DEFAULT 0,
    "dead_leads" INTEGER NOT NULL DEFAULT 0,
    "conversation_to_offer_rate" DECIMAL(5,2),
    "offer_acceptance_rate" DECIMAL(5,2),
    "overall_conversion_rate" DECIMAL(5,2),
    "avg_conversation_duration_hours" DECIMAL(10,2),
    "avg_time_to_offer_hours" DECIMAL(10,2),
    "avg_time_to_close_days" DECIMAL(10,2),
    "total_offer_value" DECIMAL(15,2),
    "total_accepted_value" DECIMAL(15,2),
    "avg_bmv_percentage" DECIMAL(5,2),
    "total_profit_potential" DECIMAL(15,2),
    "avg_motivation_score" DECIMAL(3,1),
    "avg_messages_per_conversation" DECIMAL(5,2),
    "ai_response_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_events" (
    "id" TEXT NOT NULL,
    "vendor_lead_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT,
    "details" JSONB DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_retries" (
    "id" TEXT NOT NULL,
    "vendor_lead_id" TEXT NOT NULL,
    "retry_number" INTEGER NOT NULL,
    "original_offer_amount" DECIMAL(12,2) NOT NULL,
    "adjusted_offer_amount" DECIMAL(12,2),
    "message_sent" TEXT,
    "sms_message_id" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "vendor_response" TEXT,
    "response_received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_retries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_lead_sync" (
    "id" TEXT NOT NULL,
    "facebook_lead_id" TEXT NOT NULL,
    "vendor_lead_id" TEXT,
    "lead_data" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facebook_lead_sync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_data_cache_address_idx" ON "property_data_cache"("address");

-- CreateIndex
CREATE INDEX "property_data_cache_postcode_idx" ON "property_data_cache"("postcode");

-- CreateIndex
CREATE INDEX "property_data_cache_expires_at_idx" ON "property_data_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "property_data_cache_address_postcode_key" ON "property_data_cache"("address", "postcode");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_deal_id_key" ON "vendors"("deal_id");

-- CreateIndex
CREATE INDEX "vendors_phone_idx" ON "vendors"("phone");

-- CreateIndex
CREATE INDEX "vendors_email_idx" ON "vendors"("email");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "vendors_facebook_ad_id_idx" ON "vendors"("facebook_ad_id");

-- CreateIndex
CREATE INDEX "vendor_ai_conversations_vendor_id_idx" ON "vendor_ai_conversations"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_ai_conversations_created_at_idx" ON "vendor_ai_conversations"("created_at");

-- CreateIndex
CREATE INDEX "vendor_ai_conversations_intent_idx" ON "vendor_ai_conversations"("intent");

-- CreateIndex
CREATE INDEX "vendor_offers_vendor_id_idx" ON "vendor_offers"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_offers_deal_id_idx" ON "vendor_offers"("deal_id");

-- CreateIndex
CREATE INDEX "vendor_offers_status_idx" ON "vendor_offers"("status");

-- CreateIndex
CREATE INDEX "vendor_offers_offer_date_idx" ON "vendor_offers"("offer_date");

-- CreateIndex
CREATE INDEX "investor_reservations_investor_id_idx" ON "investor_reservations"("investor_id");

-- CreateIndex
CREATE INDEX "investor_reservations_deal_id_idx" ON "investor_reservations"("deal_id");

-- CreateIndex
CREATE INDEX "investor_reservations_status_idx" ON "investor_reservations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "investor_reservations_investor_id_deal_id_key" ON "investor_reservations"("investor_id", "deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_leads_facebook_lead_id_key" ON "vendor_leads"("facebook_lead_id");

-- CreateIndex
CREATE INDEX "vendor_leads_pipeline_stage_idx" ON "vendor_leads"("pipeline_stage");

-- CreateIndex
CREATE INDEX "vendor_leads_created_at_idx" ON "vendor_leads"("created_at");

-- CreateIndex
CREATE INDEX "vendor_leads_vendor_phone_idx" ON "vendor_leads"("vendor_phone");

-- CreateIndex
CREATE INDEX "vendor_leads_facebook_lead_id_idx" ON "vendor_leads"("facebook_lead_id");

-- CreateIndex
CREATE INDEX "vendor_leads_deal_id_idx" ON "vendor_leads"("deal_id");

-- CreateIndex
CREATE INDEX "vendor_leads_motivation_score_idx" ON "vendor_leads"("motivation_score");

-- CreateIndex
CREATE INDEX "vendor_leads_next_retry_at_idx" ON "vendor_leads"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "sms_messages_message_sid_key" ON "sms_messages"("message_sid");

-- CreateIndex
CREATE INDEX "sms_messages_vendor_lead_id_idx" ON "sms_messages"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "sms_messages_created_at_idx" ON "sms_messages"("created_at");

-- CreateIndex
CREATE INDEX "sms_messages_direction_idx" ON "sms_messages"("direction");

-- CreateIndex
CREATE INDEX "sms_messages_status_idx" ON "sms_messages"("status");

-- CreateIndex
CREATE INDEX "sms_messages_message_sid_idx" ON "sms_messages"("message_sid");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_metrics_date_key" ON "pipeline_metrics"("date");

-- CreateIndex
CREATE INDEX "pipeline_metrics_date_idx" ON "pipeline_metrics"("date");

-- CreateIndex
CREATE INDEX "pipeline_events_vendor_lead_id_idx" ON "pipeline_events"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "pipeline_events_event_type_idx" ON "pipeline_events"("event_type");

-- CreateIndex
CREATE INDEX "pipeline_events_created_at_idx" ON "pipeline_events"("created_at");

-- CreateIndex
CREATE INDEX "offer_retries_vendor_lead_id_idx" ON "offer_retries"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "offer_retries_scheduled_for_idx" ON "offer_retries"("scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_lead_sync_facebook_lead_id_key" ON "facebook_lead_sync"("facebook_lead_id");

-- CreateIndex
CREATE INDEX "facebook_lead_sync_facebook_lead_id_idx" ON "facebook_lead_sync"("facebook_lead_id");

-- CreateIndex
CREATE INDEX "facebook_lead_sync_vendor_lead_id_idx" ON "facebook_lead_sync"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "facebook_lead_sync_processed_at_idx" ON "facebook_lead_sync"("processed_at");

-- CreateIndex
CREATE INDEX "communications_vendor_id_idx" ON "communications"("vendor_id");

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ai_conversations" ADD CONSTRAINT "vendor_ai_conversations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_offers" ADD CONSTRAINT "vendor_offers_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_offers" ADD CONSTRAINT "vendor_offers_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_offers" ADD CONSTRAINT "vendor_offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_reservations" ADD CONSTRAINT "investor_reservations_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_reservations" ADD CONSTRAINT "investor_reservations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_vendor_lead_id_fkey" FOREIGN KEY ("vendor_lead_id") REFERENCES "vendor_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_vendor_lead_id_fkey" FOREIGN KEY ("vendor_lead_id") REFERENCES "vendor_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_retries" ADD CONSTRAINT "offer_retries_vendor_lead_id_fkey" FOREIGN KEY ("vendor_lead_id") REFERENCES "vendor_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
