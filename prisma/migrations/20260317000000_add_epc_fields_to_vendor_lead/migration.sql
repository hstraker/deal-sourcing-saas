-- AlterTable: add EPC fields to vendor_leads
ALTER TABLE "vendor_leads" ADD COLUMN "epc_rating" TEXT;
ALTER TABLE "vendor_leads" ADD COLUMN "epc_score" INTEGER;
ALTER TABLE "vendor_leads" ADD COLUMN "epc_inspection_date" TIMESTAMP(3);
