-- Add mentions field to comments table
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "mentions" text; 