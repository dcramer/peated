CREATE TABLE IF NOT EXISTS "tasting_badge_award" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tasting_id" bigint NOT NULL,
	"award_id" bigint NOT NULL,
	"level" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "tasting_badge_award" ADD CONSTRAINT "tasting_badge_award_tasting_id_tasting_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "public"."tasting"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tasting_badge_award" ADD CONSTRAINT "tasting_badge_award_award_id_badge_award_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."badge_award"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tasting_badge_award_key" ON "tasting_badge_award" USING btree ("tasting_id","award_id");
CREATE INDEX IF NOT EXISTS "tasting_badge_award_award_id" ON "tasting_badge_award" USING btree ("award_id");