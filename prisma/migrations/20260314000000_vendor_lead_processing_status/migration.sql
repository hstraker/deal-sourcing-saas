-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- AlterTable: add processing pipeline columns to vendor_leads
ALTER TABLE "vendor_leads" ADD COLUMN "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "vendor_leads" ADD COLUMN "postcode_original" TEXT;
ALTER TABLE "vendor_leads" ADD COLUMN "bmv_validated_at" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN "portal_checked_at" TIMESTAMP(3);
ALTER TABLE "vendor_leads" ADD COLUMN "archived_at" TIMESTAMP(3);
