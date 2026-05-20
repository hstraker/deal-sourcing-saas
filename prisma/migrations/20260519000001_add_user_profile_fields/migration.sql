-- Add bio and timezone fields to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "bio"      TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/London';
