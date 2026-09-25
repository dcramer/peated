DROP INDEX "bottle_series_search_idx";
DROP INDEX "bottle_search_idx";
DROP INDEX "entity_search_idx";
ALTER TABLE "bottle_series" DROP COLUMN "search_vector";
ALTER TABLE "bottle" DROP COLUMN "search_vector";
ALTER TABLE "entity" DROP COLUMN "search_vector";