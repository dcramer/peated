CREATE TYPE "public"."tasting_draft_identification_status" AS ENUM('none', 'pending', 'done', 'failed');
ALTER TABLE "tasting_draft" ADD COLUMN "identification_status" "tasting_draft_identification_status" DEFAULT 'none' NOT NULL;
ALTER TABLE "tasting_draft" ADD COLUMN "identification" jsonb;