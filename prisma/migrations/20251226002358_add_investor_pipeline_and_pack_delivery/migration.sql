-- CreateEnum
CREATE TYPE "InvestorPipelineStage" AS ENUM ('LEAD', 'CONTACTED', 'QUALIFIED', 'VIEWING_DEALS', 'RESERVED', 'PURCHASED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InvestorActivityType" AS ENUM ('ACCOUNT_CREATED', 'PROFILE_UPDATED', 'DEAL_VIEWED', 'DEAL_FAVORITED', 'PACK_REQUESTED', 'PACK_VIEWED', 'PACK_DOWNLOADED', 'RESERVATION_MADE', 'RESERVATION_CANCELLED', 'PURCHASE_COMPLETED', 'COMMUNICATION_SENT', 'COMMUNICATION_RECEIVED');

-- AlterTable
ALTER TABLE "investors" ADD COLUMN     "active_reservations_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "assigned_to" TEXT,
ADD COLUMN     "deals_viewed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "packs_requested" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pipeline_stage" "InvestorPipelineStage" NOT NULL DEFAULT 'LEAD';

-- CreateTable
CREATE TABLE "investor_pack_deliveries" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "generation_id" TEXT,
    "delivery_method" TEXT NOT NULL DEFAULT 'email',
    "recipient_email" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewed_at" TIMESTAMP(3),
    "downloaded_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_pack_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_activities" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "activity_type" "InvestorActivityType" NOT NULL,
    "description" TEXT,
    "deal_id" TEXT,
    "reservation_id" TEXT,
    "pack_delivery_id" TEXT,
    "metadata" JSONB,
    "triggered_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_pack_deliveries_investor_id_idx" ON "investor_pack_deliveries"("investor_id");

-- CreateIndex
CREATE INDEX "investor_pack_deliveries_deal_id_idx" ON "investor_pack_deliveries"("deal_id");

-- CreateIndex
CREATE INDEX "investor_pack_deliveries_generation_id_idx" ON "investor_pack_deliveries"("generation_id");

-- CreateIndex
CREATE INDEX "investor_pack_deliveries_sent_at_idx" ON "investor_pack_deliveries"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "investor_pack_deliveries_investor_id_deal_id_generation_id_key" ON "investor_pack_deliveries"("investor_id", "deal_id", "generation_id");

-- CreateIndex
CREATE INDEX "investor_activities_investor_id_idx" ON "investor_activities"("investor_id");

-- CreateIndex
CREATE INDEX "investor_activities_activity_type_idx" ON "investor_activities"("activity_type");

-- CreateIndex
CREATE INDEX "investor_activities_deal_id_idx" ON "investor_activities"("deal_id");

-- CreateIndex
CREATE INDEX "investor_activities_created_at_idx" ON "investor_activities"("created_at");

-- CreateIndex
CREATE INDEX "investors_pipeline_stage_idx" ON "investors"("pipeline_stage");

-- CreateIndex
CREATE INDEX "investors_assigned_to_idx" ON "investors"("assigned_to");

-- CreateIndex
CREATE INDEX "investors_last_activity_at_idx" ON "investors"("last_activity_at");

-- AddForeignKey
ALTER TABLE "investors" ADD CONSTRAINT "investors_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_pack_deliveries" ADD CONSTRAINT "investor_pack_deliveries_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_pack_deliveries" ADD CONSTRAINT "investor_pack_deliveries_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_pack_deliveries" ADD CONSTRAINT "investor_pack_deliveries_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "investor_pack_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
