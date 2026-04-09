-- Add photo analysis fields to vendor_leads
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_upload_token" TEXT UNIQUE;
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_upload_expires_at" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_condition_score" INTEGER;
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_condition_override" TEXT;
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_analysis_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_analysis_completed_at" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN IF NOT EXISTS "photo_analysis_notes" TEXT;

-- Create property_photos table
CREATE TABLE IF NOT EXISTS "property_photos" (
  "id" TEXT NOT NULL,
  "vendor_lead_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "s3_key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "filename" TEXT,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "ai_room_type" TEXT,
  "ai_condition" TEXT,
  "ai_condition_score" INTEGER,
  "ai_issues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ai_description" TEXT,
  "ai_analysed_at" TIMESTAMP(3),
  "ai_raw_response" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "property_photos_vendor_lead_id_fkey" FOREIGN KEY ("vendor_lead_id") REFERENCES "vendor_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "property_photos_vendor_lead_id_idx" ON "property_photos"("vendor_lead_id");
CREATE INDEX IF NOT EXISTS "property_photos_source_idx" ON "property_photos"("source");

-- Create scraped_photos table
CREATE TABLE IF NOT EXISTS "scraped_photos" (
  "id" TEXT NOT NULL,
  "property_listing_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "ai_room_type" TEXT,
  "ai_condition" TEXT,
  "ai_condition_score" INTEGER,
  "ai_issues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ai_description" TEXT,
  "ai_analysed_at" TIMESTAMP(3),
  CONSTRAINT "scraped_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scraped_photos_property_listing_id_fkey" FOREIGN KEY ("property_listing_id") REFERENCES "property_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "scraped_photos_property_listing_id_idx" ON "scraped_photos"("property_listing_id");
