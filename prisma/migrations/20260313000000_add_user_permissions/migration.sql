-- Add permissions column to users table
ALTER TABLE "users" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT '{}';

-- Seed sensible defaults for existing users
UPDATE "users" SET "permissions" = ARRAY['invest','manage','finance','admin']
  WHERE role = 'admin';
UPDATE "users" SET "permissions" = ARRAY['invest','manage']
  WHERE role = 'sourcer';
-- investor users intentionally left as empty array {}
