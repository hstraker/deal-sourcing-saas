-- AlterTable
ALTER TABLE "vendor_leads" ADD COLUMN     "property_postcode_fixed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "property_postcode_source" TEXT;
