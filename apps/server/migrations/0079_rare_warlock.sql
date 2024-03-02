DROP INDEX IF EXISTS "entity_name_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "entity_name_unq" ON "entity" USING btree (LOWER("name"));
