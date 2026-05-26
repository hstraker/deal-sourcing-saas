-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260526000000_add_property_listing_discover_fields
-- Adds Phase 1 Discover fields to property_listings:
--   motivation_score, motivation_signals, is_welsh, jurisdiction,
--   strategy_viability, tracker_stage
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "property_listings"
  ADD COLUMN IF NOT EXISTS "motivation_score"   INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "motivation_signals" JSONB    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "is_welsh"           BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "jurisdiction"       TEXT,
  ADD COLUMN IF NOT EXISTS "strategy_viability" JSONB    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "tracker_stage"      TEXT;

-- Index for motivation score range queries / sorting
CREATE INDEX IF NOT EXISTS "idx_property_listings_motivation_score"
  ON "property_listings" ("motivation_score" DESC);

-- Index for Welsh jurisdiction filter
CREATE INDEX IF NOT EXISTS "idx_property_listings_is_welsh"
  ON "property_listings" ("is_welsh");

-- Index for tracker stage
CREATE INDEX IF NOT EXISTS "idx_property_listings_tracker_stage"
  ON "property_listings" ("tracker_stage");
