-- AlterTable: Add 4-part template support to InvestorPackTemplate
ALTER TABLE "investor_pack_templates" ADD COLUMN "template_type" TEXT NOT NULL DEFAULT 'single';
ALTER TABLE "investor_pack_templates" ADD COLUMN "orientation" TEXT NOT NULL DEFAULT 'landscape';
ALTER TABLE "investor_pack_templates" ADD COLUMN "company_logo" TEXT;
ALTER TABLE "investor_pack_templates" ADD COLUMN "part1_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "investor_pack_templates" ADD COLUMN "part1_sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "investor_pack_templates" ADD COLUMN "part2_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "investor_pack_templates" ADD COLUMN "part2_sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "investor_pack_templates" ADD COLUMN "part3_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "investor_pack_templates" ADD COLUMN "part3_sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "investor_pack_templates" ADD COLUMN "part4_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "investor_pack_templates" ADD COLUMN "part4_sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "investor_pack_templates" ADD COLUMN "include_risk_warnings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "investor_pack_templates" ALTER COLUMN "cover_style" DROP NOT NULL;

-- AlterTable: Add part tracking to InvestorPackDelivery
ALTER TABLE "investor_pack_deliveries" ADD COLUMN "part_number" INTEGER;

-- DropIndex: Remove old unique constraint
DROP INDEX IF EXISTS "investor_pack_deliveries_investor_id_deal_id_generation_id_key";

-- CreateIndex: Add new unique constraint with part_number
CREATE UNIQUE INDEX "investor_pack_deliveries_investor_id_deal_id_generation_id_part_number_key" ON "investor_pack_deliveries"("investor_id", "deal_id", "generation_id", "part_number");

-- CreateIndex: Add index on part_number
CREATE INDEX "investor_pack_deliveries_part_number_idx" ON "investor_pack_deliveries"("part_number");
