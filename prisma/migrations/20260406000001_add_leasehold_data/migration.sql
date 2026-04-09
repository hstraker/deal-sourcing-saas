-- Add leasehold_data JSON column to vendor_leads
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "leasehold_data" JSONB;
