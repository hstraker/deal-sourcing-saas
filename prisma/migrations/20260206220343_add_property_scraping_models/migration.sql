-- CreateEnum
CREATE TYPE "PropertySource" AS ENUM ('RIGHTMOVE', 'ZOOPLA', 'ONTHEMARKET');

-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('FOR_SALE', 'SOLD_STC', 'UNDER_OFFER', 'REMOVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'EXCEL', 'JSON');

-- AlterTable
ALTER TABLE "investor_pack_templates" ALTER COLUMN "cover_style" DROP DEFAULT;

-- CreateTable
CREATE TABLE "property_listings" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source" "PropertySource" NOT NULL,
    "category" "PropertyCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "property_type" TEXT NOT NULL,
    "property_sub_type" TEXT,
    "bedrooms" INTEGER NOT NULL DEFAULT 0,
    "bathrooms" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL,
    "price_history" JSONB NOT NULL DEFAULT '[]',
    "address" JSONB NOT NULL,
    "square_feet" INTEGER,
    "square_meters" INTEGER,
    "price_per_sq_ft" DECIMAL(10,2),
    "commercial_details" JSONB,
    "bmv_indicators" JSONB NOT NULL DEFAULT '{}',
    "is_ambiguous" BOOLEAN NOT NULL DEFAULT false,
    "ambiguity_reasons" JSONB NOT NULL DEFAULT '[]',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "review_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "property_data_analysis" JSONB,
    "ai_analysis" JSONB,
    "images" JSONB NOT NULL DEFAULT '[]',
    "floor_plans" JSONB NOT NULL DEFAULT '[]',
    "agent" JSONB NOT NULL DEFAULT '{}',
    "listing_url" TEXT,
    "listed_date" TIMESTAMP(3),
    "days_on_market" INTEGER NOT NULL DEFAULT 0,
    "status" "ListingStatus" NOT NULL DEFAULT 'FOR_SALE',
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_checked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT,
    "deal_id" TEXT,

    CONSTRAINT "property_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_jobs" (
    "id" TEXT NOT NULL,
    "source" "PropertySource" NOT NULL,
    "category" "PropertyCategory",
    "criteria" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "total_found" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "successful" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "properties_found" TEXT[],
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraper_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "schedule_type" TEXT NOT NULL DEFAULT 'TWICE_DAILY',
    "rightmove_enabled" BOOLEAN NOT NULL DEFAULT true,
    "zoopla_enabled" BOOLEAN NOT NULL DEFAULT true,
    "onthemarket_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_analysis_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_analysis_threshold" DECIMAL(5,2),
    "require_manual_review" BOOLEAN NOT NULL DEFAULT true,
    "request_delay" INTEGER NOT NULL DEFAULT 3000,
    "max_concurrent" INTEGER NOT NULL DEFAULT 2,
    "use_proxy" BOOLEAN NOT NULL DEFAULT false,
    "proxy_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraper_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_exports" (
    "id" TEXT NOT NULL,
    "property_id" TEXT,
    "format" "ExportFormat" NOT NULL,
    "filters" JSONB,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "file_url" TEXT,
    "exported_by" TEXT,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_listings_category_idx" ON "property_listings"("category");

-- CreateIndex
CREATE INDEX "property_listings_review_status_idx" ON "property_listings"("review_status");

-- CreateIndex
CREATE INDEX "property_listings_scraped_at_idx" ON "property_listings"("scraped_at");

-- CreateIndex
CREATE INDEX "property_listings_status_idx" ON "property_listings"("status");

-- CreateIndex
CREATE INDEX "property_listings_deal_id_idx" ON "property_listings"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_listings_source_source_id_key" ON "property_listings"("source", "source_id");

-- CreateIndex
CREATE INDEX "scraper_jobs_status_created_at_idx" ON "scraper_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "scraper_jobs_source_idx" ON "scraper_jobs"("source");

-- CreateIndex
CREATE INDEX "property_exports_exported_at_idx" ON "property_exports"("exported_at");

-- AddForeignKey
ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_exports" ADD CONSTRAINT "property_exports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "investor_pack_deliveries_investor_id_deal_id_generation_id_part" RENAME TO "investor_pack_deliveries_investor_id_deal_id_generation_id__key";
