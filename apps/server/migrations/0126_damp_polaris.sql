CREATE UNIQUE INDEX IF NOT EXISTS "entity_alias_name_idx" ON "entity_alias" USING btree (LOWER("name"));
ALTER TABLE "entity_alias" DROP CONSTRAINT "entity_alias_name_pk";
