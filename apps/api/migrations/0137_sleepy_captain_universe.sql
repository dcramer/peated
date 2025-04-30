
ALTER TYPE "badge_type" ADD VALUE 'age';
ALTER TYPE "badge_type" ADD VALUE 'entity';
ALTER TYPE "badge_type" ADD VALUE 'everyTasting';

ALTER TABLE "badge_award" RENAME COLUMN "points" TO "xp";
ALTER TABLE "badge_award" ALTER COLUMN "xp" SET NOT NULL;
ALTER TABLE "badge_award" ALTER COLUMN "level" SET NOT NULL;

ALTER TABLE "badges" ADD COLUMN "image_url" text;
ALTER TABLE "badges" ADD COLUMN "max_level" integer DEFAULT 50 NOT NULL;

DROP INDEX IF EXISTS "badge_name_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "badge_name_unq" ON "badges" USING btree (LOWER("name"));

DO $$ BEGIN
 CREATE TYPE "public"."badge_award_object_type" AS ENUM('bottle', 'entity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "badge_award_tracked_object" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"award_id" bigint NOT NULL,
	"object_type" "badge_award_object_type" NOT NULL,
	"object_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "badge_award_tracked_object_unq" ON "badge_award_tracked_object" USING btree ("award_id","object_type","object_id");

DO $$ BEGIN
 ALTER TABLE "badge_award_tracked_object" ADD CONSTRAINT "badge_award_tracked_object_award_id_badge_award_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."badge_award"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
