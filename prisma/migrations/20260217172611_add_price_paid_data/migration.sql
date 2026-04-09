-- CreateTable
CREATE TABLE "price_paid_addresses" (
    "id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "street_norm" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "town" TEXT,

    CONSTRAINT "price_paid_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_paid_imports" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "records_read" INTEGER NOT NULL DEFAULT 0,
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_paid_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_paid_addresses_street_norm_idx" ON "price_paid_addresses"("street_norm");

-- CreateIndex
CREATE INDEX "price_paid_addresses_postcode_idx" ON "price_paid_addresses"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "price_paid_addresses_street_norm_postcode_key" ON "price_paid_addresses"("street_norm", "postcode");

-- CreateIndex
CREATE INDEX "price_paid_imports_status_idx" ON "price_paid_imports"("status");

-- CreateIndex
CREATE INDEX "price_paid_imports_year_idx" ON "price_paid_imports"("year");
