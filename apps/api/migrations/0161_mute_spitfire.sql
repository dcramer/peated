DROP INDEX "bottle_series_brand_name_key";
CREATE UNIQUE INDEX "bottle_series_full_name_key" ON "bottle_series" USING btree (LOWER("full_name"));
ALTER TABLE "bottle" DROP COLUMN "series";