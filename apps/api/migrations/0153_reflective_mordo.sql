DROP INDEX "collection_name_unq";
CREATE UNIQUE INDEX "collection_name_unq" ON "collection" USING btree (LOWER("name"), "created_by_id");
