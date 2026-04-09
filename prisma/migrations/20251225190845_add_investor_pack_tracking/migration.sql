-- AlterTable
ALTER TABLE "vendor_leads" ADD COLUMN     "investor_pack_generation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_investor_pack_generated_at" TIMESTAMP(3);
