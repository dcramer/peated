ALTER TABLE "bottle" ADD COLUMN "search_vector" "tsvector";
CREATE INDEX IF NOT EXISTS "bottle_search_idx" ON "bottle" ("search_vector");