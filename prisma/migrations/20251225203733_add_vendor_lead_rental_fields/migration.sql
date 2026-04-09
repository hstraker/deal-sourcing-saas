-- AlterTable
ALTER TABLE "vendor_leads" ADD COLUMN     "estimated_annual_rent" DECIMAL(10,2),
ADD COLUMN     "estimated_monthly_rent" DECIMAL(10,2),
ADD COLUMN     "local_average_rent" DECIMAL(10,2),
ADD COLUMN     "rent_confidence" TEXT,
ADD COLUMN     "rent_per_sq_ft" DECIMAL(5,2),
ADD COLUMN     "square_feet" INTEGER;
