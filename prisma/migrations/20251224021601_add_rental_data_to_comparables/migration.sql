-- AlterTable
ALTER TABLE "comparable_properties" ADD COLUMN     "area_average_rent" DECIMAL(10,2),
ADD COLUMN     "monthly_rent" DECIMAL(10,2),
ADD COLUMN     "rental_yield" DECIMAL(5,2),
ADD COLUMN     "rental_yield_max" DECIMAL(5,2),
ADD COLUMN     "rental_yield_min" DECIMAL(5,2),
ADD COLUMN     "weekly_rent" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "comparable_properties_rental_yield_idx" ON "comparable_properties"("rental_yield");
