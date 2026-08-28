CREATE TYPE "public"."tasting_band" AS ENUM('mediocre', 'good', 'very_good', 'outstanding', 'unicorn');
CREATE TABLE "member_review" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"created_by_id" bigint NOT NULL,
	"score" smallint NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_review_score_check" CHECK ("member_review"."score" BETWEEN 0 AND 100)
);

ALTER TABLE "bottle_group" RENAME COLUMN "avg_score" TO "median_score";
ALTER TABLE "bottle_group" RENAME COLUMN "total_scores" TO "member_score_count";
ALTER TABLE "bottle" RENAME COLUMN "avg_score" TO "median_score";
ALTER TABLE "bottle" RENAME COLUMN "total_scores" TO "member_score_count";
ALTER TABLE "tasting" RENAME COLUMN "rating_legacy" TO "legacy_star_rating";
ALTER TABLE "tasting" RENAME COLUMN "rating" TO "legacy_simple_rating";
ALTER TABLE "tasting" DROP CONSTRAINT "tasting_score_check";
ALTER TABLE "tasting" DROP CONSTRAINT "tasting_rating_system_check";
ALTER TABLE "bottle_group" ADD COLUMN "min_score" smallint;
ALTER TABLE "bottle_group" ADD COLUMN "max_score" smallint;
ALTER TABLE "bottle_group" ADD COLUMN "external_score_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle_group" ADD COLUMN "tasting_band_counts" jsonb DEFAULT '{"mediocre":0,"good":0,"very_good":0,"outstanding":0,"unicorn":0}'::jsonb NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "min_score" smallint;
ALTER TABLE "bottle" ADD COLUMN "max_score" smallint;
ALTER TABLE "bottle" ADD COLUMN "external_score_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "tasting_band_counts" jsonb DEFAULT '{"mediocre":0,"good":0,"very_good":0,"outstanding":0,"unicorn":0}'::jsonb NOT NULL;
ALTER TABLE "tasting" ADD COLUMN "rating_band" "tasting_band";
ALTER TABLE "member_review" ADD CONSTRAINT "member_review_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "member_review" ADD CONSTRAINT "member_review_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "member_review_bottle_member_unq" ON "member_review" USING btree ("bottle_id","created_by_id");
CREATE INDEX "member_review_bottle_idx" ON "member_review" USING btree ("bottle_id");
CREATE INDEX "member_review_created_by_idx" ON "member_review" USING btree ("created_by_id");
ALTER TABLE "tasting" DROP COLUMN "score";
ALTER TABLE "user" DROP COLUMN "rating_system";