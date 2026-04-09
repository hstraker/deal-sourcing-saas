-- CreateTable: Add CompanyProfile table for global company information
CREATE TABLE "company_profile" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "company_email" TEXT,
    "company_phone" TEXT,
    "company_website" TEXT,
    "company_address" TEXT,
    "logo_url" TEXT,
    "logo_s3_key" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#3b82f6',
    "secondary_color" TEXT NOT NULL DEFAULT '#10b981',
    "description" TEXT,
    "tagline" TEXT,
    "linkedin_url" TEXT,
    "facebook_url" TEXT,
    "twitter_url" TEXT,
    "instagram_url" TEXT,
    "company_number" TEXT,
    "vat_number" TEXT,
    "fca_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- Insert default company profile (only one should exist)
INSERT INTO "company_profile" ("id", "company_name", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'DealStack', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
