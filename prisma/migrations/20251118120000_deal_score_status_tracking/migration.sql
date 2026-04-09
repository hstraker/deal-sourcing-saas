-- Add deal score breakdown + status tracking fields
ALTER TABLE "deals"
ADD COLUMN "deal_score_breakdown" JSONB,
ADD COLUMN "status_updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "status_history" JSONB;


