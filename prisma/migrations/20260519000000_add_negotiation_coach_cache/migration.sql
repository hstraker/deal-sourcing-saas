-- AddColumn: negotiation coach cache on vendor_leads
ALTER TABLE "vendor_leads"
  ADD COLUMN IF NOT EXISTS "negotiation_coach"    JSONB,
  ADD COLUMN IF NOT EXISTS "negotiation_coach_at" TIMESTAMPTZ;
