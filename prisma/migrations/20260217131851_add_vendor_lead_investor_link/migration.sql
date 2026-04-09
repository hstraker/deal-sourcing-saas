-- AlterTable
ALTER TABLE "vendor_leads" ADD COLUMN     "reserved_at" TIMESTAMP(3),
ADD COLUMN     "reserved_by_investor_id" TEXT;
