CREATE UNIQUE INDEX IF NOT EXISTS "bottle_full_name_unq" ON "bottle" USING btree (LOWER("full_name"));
DROP INDEX IF EXISTS "bottle_name_unq";
