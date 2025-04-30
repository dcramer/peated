CREATE UNIQUE INDEX IF NOT EXISTS "bottle_series_unq" ON "bottle" ("name","brand_id","series") WHERE series IS NOT NULL;
DROP INDEX "bottle_brand_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "bottle_brand_unq" ON "bottle" ("name","brand_id") WHERE series IS NULL;
