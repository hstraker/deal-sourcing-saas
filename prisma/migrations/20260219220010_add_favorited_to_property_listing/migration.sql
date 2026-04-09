-- AlterTable
ALTER TABLE "property_listings" ADD COLUMN     "is_favorited" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "property_listings_is_favorited_idx" ON "property_listings"("is_favorited");
