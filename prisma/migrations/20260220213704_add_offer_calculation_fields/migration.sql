-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "flip_offer_price" DECIMAL(10,2),
ADD COLUMN     "hold_offer_price" DECIMAL(10,2),
ADD COLUMN     "offer_calculated_at" TIMESTAMP(3),
ADD COLUMN     "offer_calculation" JSONB,
ADD COLUMN     "recommended_strategy" TEXT;
