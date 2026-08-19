DROP INDEX "review_unq_name";
CREATE UNIQUE INDEX "review_legacy_site_url_unq" ON "review" USING btree ("external_site_id","url") WHERE "review"."article_id" IS NULL;
CREATE UNIQUE INDEX "review_unq_name" ON "review" USING btree ("external_site_id",LOWER("name"),"issue") WHERE "review"."article_id" IS NULL;