ALTER TABLE "review" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;
ALTER TABLE "review" ADD CONSTRAINT "review_version_check" CHECK ("review"."version" >= 0);