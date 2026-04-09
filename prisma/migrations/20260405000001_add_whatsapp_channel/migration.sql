-- Migration: add_whatsapp_channel
-- Adds `channel` to sms_messages (sms | whatsapp)
-- and `preferred_channel` to vendor_leads

ALTER TABLE "sms_messages"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'sms';

ALTER TABLE "vendor_leads"
  ADD COLUMN IF NOT EXISTS "preferred_channel" TEXT NOT NULL DEFAULT 'sms';
