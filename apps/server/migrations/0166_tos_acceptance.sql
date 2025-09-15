-- Add ToS acceptance tracking to users
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS tos_accepted_at timestamp NULL;
