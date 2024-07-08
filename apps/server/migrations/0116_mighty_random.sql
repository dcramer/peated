CREATE TABLE IF NOT EXISTS "region" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country_id" bigint NOT NULL,
	"location" geometry(Point, 4326),
	"description" text,
	"description_src" "content_source",
	"total_bottles" bigint DEFAULT 0 NOT NULL,
	"total_distillers" bigint DEFAULT 0 NOT NULL
);

ALTER TABLE "entity" ADD COLUMN "region_id" bigint;
CREATE UNIQUE INDEX IF NOT EXISTS "region_name_unq" ON "region" ("country_id", LOWER("name"));
CREATE UNIQUE INDEX IF NOT EXISTS "region_slug_unq" ON "region" ("country_id", LOWER("slug"));
CREATE INDEX IF NOT EXISTS "region_country_idx" ON "region" ("country_id");
CREATE INDEX IF NOT EXISTS "entity_region_idx" ON "entity" ("region_id");
DO $$ BEGIN
 ALTER TABLE "entity" ADD CONSTRAINT "entity_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "region" ADD CONSTRAINT "region_country_id_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
