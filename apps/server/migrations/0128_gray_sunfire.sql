DROP INDEX IF EXISTS "review_unq_name";
CREATE UNIQUE INDEX IF NOT EXISTS "review_unq_name" ON "review" USING btree ("external_site_id",LOWER("name"),"issue");

DROP INDEX IF EXISTS "store_price_unq_name";
CREATE UNIQUE INDEX IF NOT EXISTS "store_price_unq_name" ON "store_price" USING btree ("external_site_id",LOWER("name"),"volume");
