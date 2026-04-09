-- AlterEnum
ALTER TYPE "PropertySource" ADD VALUE 'PRIMELOCATION';

-- AlterTable
ALTER TABLE "property_listings" ADD COLUMN     "epc_rating" TEXT,
ADD COLUMN     "ground_rent" DECIMAL(10,2),
ADD COLUMN     "is_chain_free" BOOLEAN,
ADD COLUMN     "is_new_build" BOOLEAN,
ADD COLUMN     "is_retirement" BOOLEAN,
ADD COLUMN     "key_features" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "lease_years_remaining" INTEGER,
ADD COLUMN     "service_charge" DECIMAL(10,2),
ADD COLUMN     "tenure" TEXT;

-- AlterTable
ALTER TABLE "scraper_settings" ADD COLUMN     "primelocation_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "search_criteria" JSONB;

-- CreateTable
CREATE TABLE "company_ownership" (
    "id" TEXT NOT NULL,
    "title_number" TEXT NOT NULL,
    "tenure" TEXT,
    "property_address" TEXT NOT NULL,
    "postcode" TEXT,
    "postcode_normalized" TEXT,
    "company_name" TEXT NOT NULL,
    "company_reg_number" TEXT,
    "company_address" TEXT,
    "proprietor_category" TEXT,
    "country_incorporated" TEXT,
    "is_overseas" BOOLEAN NOT NULL DEFAULT false,
    "date_proprietary" TEXT,
    "price_paid" DECIMAL(12,2),
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "land_registry_imports" (
    "id" TEXT NOT NULL,
    "dataset_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "records_imported" INTEGER NOT NULL DEFAULT 0,
    "records_total" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "bytes_downloaded" TEXT,
    "bytes_total" TEXT,
    "download_speed" DECIMAL(10,2),
    "estimated_time_remaining" INTEGER,
    "last_processed_position" TEXT,
    "resume_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_registry_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_ownership_title_number_key" ON "company_ownership"("title_number");

-- CreateIndex
CREATE INDEX "company_ownership_postcode_normalized_idx" ON "company_ownership"("postcode_normalized");

-- CreateIndex
CREATE INDEX "company_ownership_company_reg_number_idx" ON "company_ownership"("company_reg_number");

-- CreateIndex
CREATE INDEX "company_ownership_is_overseas_idx" ON "company_ownership"("is_overseas");

-- CreateIndex
CREATE INDEX "land_registry_imports_dataset_type_created_at_idx" ON "land_registry_imports"("dataset_type", "created_at");

-- CreateIndex
CREATE INDEX "land_registry_imports_status_idx" ON "land_registry_imports"("status");
