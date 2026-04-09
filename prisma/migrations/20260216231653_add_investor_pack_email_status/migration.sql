-- AlterTable
ALTER TABLE "investor_pack_deliveries" ADD COLUMN     "email_error" TEXT,
ADD COLUMN     "email_status" TEXT DEFAULT 'pending';
