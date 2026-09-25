ALTER TABLE "bottle_series" ADD COLUMN "search_names" text DEFAULT '' NOT NULL;
ALTER TABLE "entity" ADD COLUMN "search_names" text DEFAULT '' NOT NULL;
CREATE INDEX "bottle_series_search_names_tin_idx" ON "bottle_series" USING tin ("search_names");
CREATE INDEX "entity_search_names_tin_idx" ON "entity" USING tin ("search_names");