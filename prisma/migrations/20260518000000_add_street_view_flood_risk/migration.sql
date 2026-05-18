-- AddColumn: street_view_analysis, street_view_analysed_at, flood_risk_zone, flood_risk_checked_at to VendorLead
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "street_view_analysis"    JSONB;
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "street_view_analysed_at" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "flood_risk_zone"         TEXT;
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "flood_risk_checked_at"   TIMESTAMP(3);
