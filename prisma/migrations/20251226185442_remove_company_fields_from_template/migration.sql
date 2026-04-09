-- Remove company-specific fields from InvestorPackTemplate
-- Company information now comes from the global CompanyProfile table

ALTER TABLE "investor_pack_templates" DROP COLUMN IF EXISTS "logo_url";
ALTER TABLE "investor_pack_templates" DROP COLUMN IF EXISTS "company_name";
ALTER TABLE "investor_pack_templates" DROP COLUMN IF EXISTS "company_phone";
ALTER TABLE "investor_pack_templates" DROP COLUMN IF EXISTS "company_email";
ALTER TABLE "investor_pack_templates" DROP COLUMN IF EXISTS "company_website";
ALTER TABLE "investor_pack_templates" DROP COLUMN IF EXISTS "company_logo";
