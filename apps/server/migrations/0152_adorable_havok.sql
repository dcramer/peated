CREATE INDEX "tasting_edition_idx" ON "tasting" USING btree ("edition_id");

DROP INDEX "tasting_unq";
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_unq" UNIQUE NULLS NOT DISTINCT("bottle_id","edition_id","created_by_id","created_at");
