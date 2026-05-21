-- Add property history cache columns to vendor_leads
ALTER TABLE "vendor_leads"
  ADD COLUMN IF NOT EXISTS "property_history"    JSONB,
  ADD COLUMN IF NOT EXISTS "property_history_at" TIMESTAMPTZ;
