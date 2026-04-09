-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "current_offer_price" DOUBLE PRECISION,
ADD COLUMN     "current_offer_round" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deal_agreed_at" TIMESTAMP(3),
ADD COLUMN     "deal_agreed_price" DOUBLE PRECISION,
ADD COLUMN     "negotiation_ladder" JSONB,
ADD COLUMN     "negotiation_strategy" TEXT,
ADD COLUMN     "offer_outcome" TEXT;
