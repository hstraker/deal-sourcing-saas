-- AlterTable
ALTER TABLE "vendor_leads" ADD COLUMN     "avg_comparable_price" DECIMAL(10,2),
ADD COLUMN     "comparables_confidence" TEXT,
ADD COLUMN     "comparables_count" INTEGER DEFAULT 0,
ADD COLUMN     "comparables_fetched_at" TIMESTAMP(3),
ADD COLUMN     "comparables_search_radius" INTEGER DEFAULT 3;

-- CreateTable
CREATE TABLE "comparables_config" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "search_radius" INTEGER NOT NULL DEFAULT 3,
    "max_results" INTEGER NOT NULL DEFAULT 5,
    "max_age_months" INTEGER NOT NULL DEFAULT 12,
    "bedroom_tolerance" INTEGER NOT NULL DEFAULT 1,
    "include_property_types" TEXT[],
    "min_confidence_score" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comparables_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparable_properties" (
    "id" TEXT NOT NULL,
    "vendor_lead_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "sale_price" DECIMAL(10,2) NOT NULL,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "property_type" TEXT,
    "square_feet" INTEGER,
    "distance" DECIMAL(5,2),
    "days_on_market" INTEGER,
    "price_reductions" INTEGER NOT NULL DEFAULT 0,
    "listing_source" TEXT,
    "listing_url" TEXT,
    "propertydata_id" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "notes" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparable_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparables_snapshots" (
    "id" TEXT NOT NULL,
    "vendor_lead_id" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "avg_price" DECIMAL(10,2),
    "comparables_count" INTEGER NOT NULL,
    "search_radius" INTEGER NOT NULL,
    "confidence" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparables_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comparables_config_user_id_key" ON "comparables_config"("user_id");

-- CreateIndex
CREATE INDEX "comparable_properties_vendor_lead_id_idx" ON "comparable_properties"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "comparable_properties_postcode_idx" ON "comparable_properties"("postcode");

-- CreateIndex
CREATE INDEX "comparable_properties_sale_date_idx" ON "comparable_properties"("sale_date");

-- CreateIndex
CREATE INDEX "comparable_properties_fetched_at_idx" ON "comparable_properties"("fetched_at");

-- CreateIndex
CREATE INDEX "comparables_snapshots_vendor_lead_id_idx" ON "comparables_snapshots"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "comparables_snapshots_snapshot_date_idx" ON "comparables_snapshots"("snapshot_date");

-- AddForeignKey
ALTER TABLE "comparables_config" ADD CONSTRAINT "comparables_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparable_properties" ADD CONSTRAINT "comparable_properties_vendor_lead_id_fkey" FOREIGN KEY ("vendor_lead_id") REFERENCES "vendor_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparables_snapshots" ADD CONSTRAINT "comparables_snapshots_vendor_lead_id_fkey" FOREIGN KEY ("vendor_lead_id") REFERENCES "vendor_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
