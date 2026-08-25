ALTER TABLE "bottle_group" ADD COLUMN "avg_score" double precision;
ALTER TABLE "bottle_group" ADD COLUMN "total_scores" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "avg_score" double precision;
ALTER TABLE "bottle" ADD COLUMN "total_scores" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "tasting" ADD COLUMN "score" smallint;
ALTER TABLE "user" ADD COLUMN "rating_system" varchar(16) DEFAULT 'simple' NOT NULL;
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_score_check" CHECK ("tasting"."score" IS NULL OR ("tasting"."score" >= 0 AND "tasting"."score" <= 100));
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_rating_system_check" CHECK ("tasting"."rating" IS NULL OR "tasting"."score" IS NULL);