-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'sourcer', 'investor');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('new', 'review', 'in_progress', 'ready', 'listed', 'reserved', 'sold', 'archived');

-- CreateEnum
CREATE TYPE "PackTier" AS ENUM ('basic', 'standard', 'premium');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'refunded');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('email', 'sms', 'call', 'note');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('epc', 'floorplan', 'title', 'survey', 'pack');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferred_areas" TEXT[],
    "min_budget" INTEGER,
    "max_budget" INTEGER,
    "min_yield" DECIMAL(5,2),
    "min_bmv" DECIMAL(5,2),
    "strategy" TEXT[],
    "experience_level" TEXT,
    "financing_status" TEXT,
    "deals_purchased" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "email_alerts" BOOLEAN NOT NULL DEFAULT true,
    "sms_alerts" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "property_type" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "square_feet" INTEGER,
    "asking_price" DECIMAL(10,2) NOT NULL,
    "market_value" DECIMAL(10,2),
    "estimated_refurb_cost" DECIMAL(10,2),
    "after_refurb_value" DECIMAL(10,2),
    "bmv_percentage" DECIMAL(5,2),
    "gross_yield" DECIMAL(5,2),
    "net_yield" DECIMAL(5,2),
    "roi" DECIMAL(5,2),
    "roce" DECIMAL(5,2),
    "deal_score" INTEGER,
    "status" "DealStatus" NOT NULL DEFAULT 'new',
    "pack_tier" "PackTier",
    "pack_price" DECIMAL(10,2),
    "data_source" TEXT,
    "external_id" TEXT,
    "agent_name" TEXT,
    "agent_phone" TEXT,
    "listing_url" TEXT,
    "assigned_to" TEXT,
    "created_by" TEXT,
    "sold_to" TEXT,
    "sold_at" TIMESTAMP(3),
    "sold_price" DECIMAL(10,2),
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "favorites_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "listed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_photos" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "s3_url" TEXT NOT NULL,
    "caption" TEXT,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_documents" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "s3_url" TEXT NOT NULL,
    "filename" TEXT,
    "file_size" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparables" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "sale_price" DECIMAL(10,2),
    "sale_date" DATE,
    "bedrooms" INTEGER,
    "property_type" TEXT,
    "distance_km" DECIMAL(5,2),
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "stripe_payment_id" TEXT,
    "stripe_invoice_id" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "pack_downloaded" BOOLEAN NOT NULL DEFAULT false,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "first_download_at" TIMESTAMP(3),
    "investor_proceeded" BOOLEAN,
    "feedback_rating" INTEGER,
    "feedback_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_views" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "investor_id" TEXT,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "type" "CommunicationType" NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_opened" BOOLEAN NOT NULL DEFAULT false,
    "email_clicked" BOOLEAN NOT NULL DEFAULT false,
    "sent_by" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "investors_user_id_key" ON "investors"("user_id");

-- CreateIndex
CREATE INDEX "investors_user_id_idx" ON "investors"("user_id");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_postcode_idx" ON "deals"("postcode");

-- CreateIndex
CREATE INDEX "deals_deal_score_idx" ON "deals"("deal_score");

-- CreateIndex
CREATE INDEX "deals_created_at_idx" ON "deals"("created_at");

-- CreateIndex
CREATE INDEX "deals_assigned_to_idx" ON "deals"("assigned_to");

-- CreateIndex
CREATE INDEX "deal_photos_deal_id_idx" ON "deal_photos"("deal_id");

-- CreateIndex
CREATE INDEX "deal_documents_deal_id_idx" ON "deal_documents"("deal_id");

-- CreateIndex
CREATE INDEX "deal_documents_document_type_idx" ON "deal_documents"("document_type");

-- CreateIndex
CREATE INDEX "comparables_deal_id_idx" ON "comparables"("deal_id");

-- CreateIndex
CREATE INDEX "purchases_deal_id_idx" ON "purchases"("deal_id");

-- CreateIndex
CREATE INDEX "purchases_investor_id_idx" ON "purchases"("investor_id");

-- CreateIndex
CREATE INDEX "purchases_payment_status_idx" ON "purchases"("payment_status");

-- CreateIndex
CREATE INDEX "favorites_investor_id_idx" ON "favorites"("investor_id");

-- CreateIndex
CREATE INDEX "favorites_deal_id_idx" ON "favorites"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_investor_id_deal_id_key" ON "favorites"("investor_id", "deal_id");

-- CreateIndex
CREATE INDEX "deal_views_deal_id_idx" ON "deal_views"("deal_id");

-- CreateIndex
CREATE INDEX "deal_views_investor_id_idx" ON "deal_views"("investor_id");

-- CreateIndex
CREATE INDEX "deal_views_viewed_at_idx" ON "deal_views"("viewed_at");

-- CreateIndex
CREATE INDEX "communications_investor_id_idx" ON "communications"("investor_id");

-- CreateIndex
CREATE INDEX "communications_deal_id_idx" ON "communications"("deal_id");

-- CreateIndex
CREATE INDEX "communications_type_idx" ON "communications"("type");

-- CreateIndex
CREATE INDEX "alerts_investor_id_idx" ON "alerts"("investor_id");

-- CreateIndex
CREATE INDEX "alerts_is_active_idx" ON "alerts"("is_active");

-- AddForeignKey
ALTER TABLE "investors" ADD CONSTRAINT "investors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_sold_to_fkey" FOREIGN KEY ("sold_to") REFERENCES "investors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_photos" ADD CONSTRAINT "deal_photos_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparables" ADD CONSTRAINT "comparables_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_views" ADD CONSTRAINT "deal_views_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_views" ADD CONSTRAINT "deal_views_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
