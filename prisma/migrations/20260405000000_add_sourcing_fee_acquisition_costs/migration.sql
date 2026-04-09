-- Migration: add_sourcing_fee_acquisition_costs
-- Adds sourcing fee tracking, co-sourcing split, associated costs,
-- invoice/payment dates, and acquisition cost overrides (SDLT buyer type,
-- solicitor/survey/bridging/insurance fee overrides).

ALTER TABLE "vendor_leads"
  -- Sourcing Fee & Deal P&L
  ADD COLUMN IF NOT EXISTS "sourcing_fee"               DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "sourcing_fee_type"          TEXT,
  ADD COLUMN IF NOT EXISTS "sourcing_fee_percent"       DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "co_sourcing_partner"        TEXT,
  ADD COLUMN IF NOT EXISTS "co_sourcing_fee_percent"    DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "acquisition_cost_survey"    DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "acquisition_cost_legal"     DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "acquisition_cost_marketing" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "acquisition_cost_other"     DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "sourcing_fee_invoiced_at"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourcing_fee_paid_at"       TIMESTAMP(3),
  -- Acquisition Cost Overrides
  ADD COLUMN IF NOT EXISTS "sdlt_buyer_type"            TEXT,
  ADD COLUMN IF NOT EXISTS "solicitor_fees_override"    DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "survey_fee_override"        DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "bridging_cost_override"     DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "insurance_override"         DECIMAL(10, 2);
