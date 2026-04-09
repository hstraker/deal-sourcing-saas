-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReservationStatus" ADD VALUE 'pack_sent';
ALTER TYPE "ReservationStatus" ADD VALUE 'fee_paid';
ALTER TYPE "ReservationStatus" ADD VALUE 'pof_received';
ALTER TYPE "ReservationStatus" ADD VALUE 'lock_out_sent';

-- AlterTable
ALTER TABLE "investor_reservations" ADD COLUMN     "proof_of_funds_received_at" TIMESTAMP(3);
