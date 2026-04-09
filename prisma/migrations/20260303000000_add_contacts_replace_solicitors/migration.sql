-- Migration: add_contacts_replace_solicitors
-- Replaces the Solicitor model with a general-purpose Contact model.
-- Existing solicitor records are preserved with their IDs intact so all FK values remain valid.

-- ─── 1. Create ContactType enum ───────────────────────────────────────────────

CREATE TYPE "ContactType" AS ENUM (
  'SOLICITOR',
  'INVESTOR_CONTACT',
  'VENDOR_CONTACT',
  'ESTATE_AGENT',
  'CONTRACTOR',
  'OTHER'
);

-- ─── 2. Create contacts table ─────────────────────────────────────────────────

CREATE TABLE "contacts" (
  "id"               TEXT NOT NULL,
  "type"             "ContactType" NOT NULL,
  "first_name"       TEXT NOT NULL,
  "last_name"        TEXT NOT NULL,
  "full_name"        TEXT NOT NULL,
  "company"          TEXT,
  "job_title"        TEXT,
  "email"            TEXT,
  "phone"            TEXT,
  "mobile_phone"     TEXT,
  "address_line1"    TEXT,
  "address_line2"    TEXT,
  "city"             TEXT,
  "county"           TEXT,
  "postcode"         TEXT,
  "sra_number"       TEXT,
  "sra_verified"     BOOLEAN NOT NULL DEFAULT false,
  "sra_verified_at"  TIMESTAMP(3),
  "sra_status"       TEXT,
  "sra_display_name" TEXT,
  "practice_areas"   TEXT[] NOT NULL DEFAULT '{}',
  "website"          TEXT,
  "notes"            TEXT,
  "tags"             TEXT[] NOT NULL DEFAULT '{}',
  "is_preferred"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on sra_number (allows nulls — Postgres only enforces uniqueness on non-nulls)
CREATE UNIQUE INDEX "contacts_sra_number_key" ON "contacts"("sra_number");

-- Indexes
CREATE INDEX "contacts_type_idx"        ON "contacts"("type");
CREATE INDEX "contacts_sra_number_idx"  ON "contacts"("sra_number");
CREATE INDEX "contacts_full_name_idx"   ON "contacts"("full_name");
CREATE INDEX "contacts_postcode_idx"    ON "contacts"("postcode");
CREATE INDEX "contacts_is_preferred_idx" ON "contacts"("is_preferred");

-- ─── 3. Migrate solicitors → contacts (preserve original IDs) ─────────────────

INSERT INTO "contacts" (
  "id", "type",
  "first_name", "last_name", "full_name",
  "company", "email", "phone", "website",
  "address_line1", "notes",
  "sra_number", "sra_verified", "sra_verified_at",
  "sra_status", "sra_display_name",
  "practice_areas", "tags", "is_preferred",
  "created_at", "updated_at"
)
SELECT
  id,
  'SOLICITOR'::"ContactType",
  -- first_name: everything before the last space (or whole name if no space)
  CASE
    WHEN POSITION(' ' IN name) > 0
    THEN LEFT(name, LENGTH(name) - POSITION(' ' IN REVERSE(name)))
    ELSE name
  END,
  -- last_name: last word (empty string if no space)
  CASE
    WHEN POSITION(' ' IN name) > 0
    THEN RIGHT(name, POSITION(' ' IN REVERSE(name)) - 1)
    ELSE ''
  END,
  name,         -- full_name
  firm_name,    -- company
  email,
  phone,
  website,
  address,      -- address_line1 (legacy free-text field)
  notes,
  sra_number,
  sra_verified,
  sra_verified_at,
  sra_status,
  sra_display_name,
  '{}',         -- practice_areas
  '{}',         -- tags
  false,        -- is_preferred
  created_at,
  updated_at
FROM "solicitors";

-- ─── 4. Re-point FK constraints from solicitors → contacts ────────────────────

-- vendor_leads.solicitor_id
ALTER TABLE "vendor_leads" DROP CONSTRAINT "vendor_leads_solicitor_id_fkey";
ALTER TABLE "vendor_leads"
  ADD CONSTRAINT "vendor_leads_solicitor_id_fkey"
  FOREIGN KEY ("solicitor_id") REFERENCES "contacts"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;

-- investors.default_solicitor_id
ALTER TABLE "investors" DROP CONSTRAINT "investors_default_solicitor_id_fkey";
ALTER TABLE "investors"
  ADD CONSTRAINT "investors_default_solicitor_id_fkey"
  FOREIGN KEY ("default_solicitor_id") REFERENCES "contacts"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;

-- ─── 5. Drop the solicitors table ────────────────────────────────────────────

DROP TABLE "solicitors";
