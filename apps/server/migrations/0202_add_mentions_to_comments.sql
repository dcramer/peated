-- Add mentions field to comments table with a length constraint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "mentions" varchar(500); 