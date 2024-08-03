CREATE TABLE IF NOT EXISTS "bottle_edition" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"search_vector" "tsvector",
	"edition_name" varchar,
	"vintage_year" smallint,
	"cask_size" varchar(255),
	"cask_type" varchar(255),
	"cask_fill" varchar(255),
	"release_year" smallint,
	"bottle_year" smallint,
	"tasting_notes" jsonb,
	"suggested_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL,
	"avg_rating" double precision,
	"total_tastings" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

ALTER TABLE "bottle" ADD COLUMN "cask_strength" boolean;
ALTER TABLE "bottle" ADD COLUMN "single_cask" boolean;
DO $$ BEGIN
 ALTER TABLE "bottle_edition" ADD CONSTRAINT "bottle_edition_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bottle_edition" ADD CONSTRAINT "bottle_edition_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "bottle_edition_bottle_idx" ON "bottle_edition" USING btree ("bottle_id");
CREATE INDEX IF NOT EXISTS "bottle_edition_search_idx" ON "bottle_edition" USING gin ("search_vector");
CREATE INDEX IF NOT EXISTS "bottle_edition_created_by_idx" ON "bottle_edition" USING btree ("created_by_id");