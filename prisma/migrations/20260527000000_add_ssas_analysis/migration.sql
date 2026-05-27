-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260527000000_add_ssas_analysis
-- Adds SSAS commercial property analysis result column to property_listings.
-- Also adds annual_rent column (some listings have this in commercialDetails
-- but we expose it as a top-level column for SSAS sorting/filtering).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "property_listings"
  ADD COLUMN IF NOT EXISTS "ssas_analysis"  JSONB,
  ADD COLUMN IF NOT EXISTS "annual_rent"    INTEGER;   -- £/year, for SSAS yield calc

-- Index for SSAS filtering: recommendation, risk score
CREATE INDEX IF NOT EXISTS "idx_property_listings_ssas_recommendation"
  ON "property_listings" (("ssas_analysis"->>'recommendation'))
  WHERE "ssas_analysis" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_property_listings_annual_rent"
  ON "property_listings" ("annual_rent")
  WHERE "annual_rent" IS NOT NULL;
