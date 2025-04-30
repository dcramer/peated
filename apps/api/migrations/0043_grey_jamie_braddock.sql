UPDATE "bottle" SET "name" = "name" || ' ' || "series" WHERE "series" IS NOT NULL;
UPDATE "bottle" SET "series" = NULL;

DROP INDEX IF EXISTS "bottle_brand_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "bottle_brand_unq" ON "bottle" ("name", "brand_id");

DROP INDEX IF EXISTS "bottle_series_unq";

DROP INDEX IF EXISTS "collection_bottle_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "collection_bottle_unq" ON "collection_bottle" ("collection_id","bottle_id");

ALTER TABLE "bottle" DROP COLUMN IF EXISTS "series";
ALTER TABLE "collection_bottle" DROP COLUMN IF EXISTS "vintage_fingerprint";
ALTER TABLE "collection_bottle" DROP COLUMN IF EXISTS "series";
ALTER TABLE "collection_bottle" DROP COLUMN IF EXISTS "vintage_year";
ALTER TABLE "collection_bottle" DROP COLUMN IF EXISTS "barrel";
ALTER TABLE "tasting" DROP COLUMN IF EXISTS "series";
ALTER TABLE "tasting" DROP COLUMN IF EXISTS "vintage_year";
ALTER TABLE "tasting" DROP COLUMN IF EXISTS "barrel";
