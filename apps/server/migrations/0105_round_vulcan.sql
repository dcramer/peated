ALTER TABLE "entity" ADD COLUMN "search_vector" "tsvector";
CREATE INDEX IF NOT EXISTS "entity_search_idx" ON "entity" USING gin("search_vector");
