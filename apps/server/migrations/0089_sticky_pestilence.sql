create extension tsvector2;

ALTER TABLE "bottle" ADD COLUMN "ts" "tsvector generated always as (to_tsvector('english', fullName)) stored";
CREATE INDEX IF NOT EXISTS "bottle_ts" ON "bottle" USING GIN ("ts");
