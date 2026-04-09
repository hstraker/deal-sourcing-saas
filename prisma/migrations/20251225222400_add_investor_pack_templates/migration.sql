-- CreateTable
CREATE TABLE "investor_pack_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cover_style" TEXT NOT NULL DEFAULT 'modern',
    "color_scheme" TEXT NOT NULL DEFAULT 'blue',
    "logo_url" TEXT,
    "company_name" TEXT NOT NULL DEFAULT 'DealStack',
    "company_phone" TEXT,
    "company_email" TEXT,
    "company_website" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "metrics_config" JSONB NOT NULL DEFAULT '{}',
    "custom_fields" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_pack_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_pack_generations" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "vendor_lead_id" TEXT,
    "deal_id" TEXT,
    "property_address" TEXT NOT NULL,
    "asking_price" DECIMAL(10,2) NOT NULL,
    "generated_by" TEXT NOT NULL,
    "file_size" INTEGER,
    "page_count" INTEGER,
    "sent_to_email" TEXT,
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "downloaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_pack_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_pack_templates_is_default_idx" ON "investor_pack_templates"("is_default");

-- CreateIndex
CREATE INDEX "investor_pack_templates_is_active_idx" ON "investor_pack_templates"("is_active");

-- CreateIndex
CREATE INDEX "investor_pack_templates_created_by_idx" ON "investor_pack_templates"("created_by");

-- CreateIndex
CREATE INDEX "investor_pack_generations_template_id_idx" ON "investor_pack_generations"("template_id");

-- CreateIndex
CREATE INDEX "investor_pack_generations_vendor_lead_id_idx" ON "investor_pack_generations"("vendor_lead_id");

-- CreateIndex
CREATE INDEX "investor_pack_generations_deal_id_idx" ON "investor_pack_generations"("deal_id");

-- CreateIndex
CREATE INDEX "investor_pack_generations_generated_by_idx" ON "investor_pack_generations"("generated_by");

-- CreateIndex
CREATE INDEX "investor_pack_generations_created_at_idx" ON "investor_pack_generations"("created_at");

-- AddForeignKey
ALTER TABLE "investor_pack_generations" ADD CONSTRAINT "investor_pack_generations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "investor_pack_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
