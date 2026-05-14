-- =============================================================================
-- Migration: Deal Analysis Updates — Jurisdiction, Rent, Tenancy, Tax, Strategy
-- Generated: 2026-05-14
-- Context: Supports Welsh LTT, per-strategy viability, and verified rent chain
-- =============================================================================

-- Run inside a transaction so any failure rolls back cleanly
BEGIN;

-- ── Jurisdiction ──────────────────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(10) NOT NULL DEFAULT 'ENGLAND';

-- Generated column: auto-true when jurisdiction = WALES
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_welsh BOOLEAN
  GENERATED ALWAYS AS (jurisdiction = 'WALES') STORED;

-- ── Rent fields ───────────────────────────────────────────────────────────────

-- Verified sitting-tenant rent — highest priority in the rent resolver chain
ALTER TABLE deals ADD COLUMN IF NOT EXISTS verified_rent INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS verified_rent_source VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS verified_rent_date DATE;

-- Which level of the priority chain supplied the rent figure
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rent_source VARCHAR(50);
  -- Allowed values: 'verified_tenant' | 'agreed_tenant' | 'sourcer_estimate' | 'api_estimate'

-- API comparable metadata stored so we can audit confidence later
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rent_confidence VARCHAR(10);
  -- Allowed values: 'verified' | 'high' | 'medium' | 'low'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS api_comparable_count INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS api_rent_min INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS api_rent_max INTEGER;

-- ── Tenancy ───────────────────────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_tenanted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenant_contract_type VARCHAR(20);
  -- Allowed values: 'ftsc' | 'periodic' | 'ast'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenant_months_remaining INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenant_issues BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS void_risk_pct DECIMAL(4,2) NOT NULL DEFAULT 5.00;

-- ── Tax ───────────────────────────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tax_type VARCHAR(10);
  -- Allowed values: 'LTT' | 'SDLT'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tax_amount INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sourcer_tax_quote INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tax_discrepancy_flag BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Add-value / BRRR ──────────────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS add_value_potential VARCHAR(10) NOT NULL DEFAULT 'none';
  -- Allowed values: 'none' | 'minor' | 'moderate' | 'major'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS post_works_gdv INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS bmv_post_works DECIMAL(5,2);

-- ── Per-strategy viability (replaces single pass/fail boolean) ────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS btl_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS brrr_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS buy_hold_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flip_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS viable_strategy_count INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS recommended_strategy VARCHAR(20);
  -- Allowed values: 'btl' | 'brrr' | 'buyAndHold' | 'flip' | NULL

-- ── Deprecate old pass/fail ───────────────────────────────────────────────────
-- Renamed to legacy_pass_fail to preserve data for rollback.
-- DO NOT DROP until new columns are confirmed working in production.
-- To rename: ALTER TABLE deals RENAME COLUMN pass_fail TO legacy_pass_fail;
-- After confirming: ALTER TABLE deals DROP COLUMN IF EXISTS legacy_pass_fail;

-- Safest approach: add the legacy column pointing to old data
ALTER TABLE deals ADD COLUMN IF NOT EXISTS legacy_pass_fail BOOLEAN;

-- Backfill legacy_pass_fail from pass_fail if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='pass_fail'
  ) THEN
    UPDATE deals SET legacy_pass_fail = pass_fail WHERE legacy_pass_fail IS NULL;
  END IF;
END $$;

-- ── Indexes for common query patterns ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deals_jurisdiction         ON deals (jurisdiction);
CREATE INDEX IF NOT EXISTS idx_deals_viable_strategy_count ON deals (viable_strategy_count);
CREATE INDEX IF NOT EXISTS idx_deals_recommended_strategy ON deals (recommended_strategy);
CREATE INDEX IF NOT EXISTS idx_deals_rent_confidence      ON deals (rent_confidence);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON COLUMN deals.jurisdiction IS 'WALES or ENGLAND — drives LTT vs SDLT and tenancy law';
COMMENT ON COLUMN deals.is_welsh IS 'Generated: true when jurisdiction=WALES';
COMMENT ON COLUMN deals.verified_rent IS 'Confirmed sitting-tenant rent PCM — highest priority in rent resolver';
COMMENT ON COLUMN deals.rent_source IS 'Which level of the priority chain was used: verified_tenant | agreed_tenant | sourcer_estimate | api_estimate';
COMMENT ON COLUMN deals.rent_confidence IS 'Confidence rating of the rent figure: verified | high | medium | low';
COMMENT ON COLUMN deals.viable_strategy_count IS 'Count of BTL/BRRR/BuyAndHold/Flip strategies that passed viability checks';
COMMENT ON COLUMN deals.legacy_pass_fail IS 'Old single-boolean pass/fail — kept for rollback. Do not use in new code.';

COMMIT;
