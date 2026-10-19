CREATE TYPE "public"."tasting_draft_identification_status" AS ENUM('none', 'pending', 'done', 'failed');
ALTER TABLE "tasting_draft" ADD COLUMN "identification_status" "tasting_draft_identification_status" DEFAULT 'none' NOT NULL;
ALTER TABLE "tasting_draft" ADD COLUMN "identification_attempts" smallint DEFAULT 0 NOT NULL;
ALTER TABLE "tasting_draft" ADD COLUMN "identification_queued_at" timestamp;
ALTER TABLE "tasting_draft" ADD COLUMN "identification" jsonb;
CREATE INDEX "tasting_draft_identification_pending_idx" ON "tasting_draft" USING btree ("identification_queued_at") WHERE "tasting_draft"."identification_status" = 'pending';