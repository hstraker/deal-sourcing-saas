-- Add completion timeline fields to vendor_leads
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "target_exchange_date" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "target_completion_date" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "solicitor_instructed_at" TIMESTAMP(3);
