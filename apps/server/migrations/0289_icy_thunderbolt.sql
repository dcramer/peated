ALTER TABLE "bottle" ADD COLUMN "search_names" text DEFAULT '' NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "search_terms" text DEFAULT '' NOT NULL;
CREATE INDEX "bottle_search_names_tin_idx" ON "bottle" USING tin ("search_names");
CREATE INDEX "bottle_search_terms_tin_idx" ON "bottle" USING tin ("search_terms");