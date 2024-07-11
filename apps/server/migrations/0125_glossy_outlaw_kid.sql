CREATE UNIQUE INDEX IF NOT EXISTS "bottle_alias_name_idx" ON "bottle_alias" USING btree (LOWER("name"));
ALTER TABLE "bottle_alias" DROP CONSTRAINT "bottle_alias_name_pk";

-- these should mostly be already present...
DROP INDEX IF EXISTS "country_name_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "country_name_unq" ON "country" USING btree (LOWER("name"));
DROP INDEX IF EXISTS "country_slug_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "country_slug_unq" ON "country" USING btree (LOWER("slug"));

DROP INDEX IF EXISTS "entity_name_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "entity_name_unq" ON "entity" USING btree (LOWER("name"));

DROP INDEX IF EXISTS "region_name_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "region_name_unq" ON "region" USING btree ("country_id",LOWER("name"));

DROP INDEX IF EXISTS "region_slug_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "region_slug_unq" ON "region" USING btree ("country_id",LOWER("slug"));

DROP INDEX IF EXISTS "bottle_search_idx";
CREATE INDEX IF NOT EXISTS "bottle_search_idx" ON "bottle" USING gin ("search_vector");
DROP INDEX IF EXISTS "entity_search_idx";
CREATE INDEX IF NOT EXISTS "entity_search_idx" ON "entity" USING gin ("search_vector");
