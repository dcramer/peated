ALTER TABLE "bottle_alias" ADD COLUMN "edition_id" bigint;
ALTER TABLE "collection_bottle" ADD COLUMN "edition_id" bigint;
ALTER TABLE "flight_bottle" ADD COLUMN "edition_id" bigint;
ALTER TABLE "tasting" ADD COLUMN "edition_id" bigint;
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_edition_id_bottle_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."bottle_edition"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_edition_id_bottle_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."bottle_edition"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_edition_id_bottle_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."bottle_edition"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_edition_id_bottle_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."bottle_edition"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_alias_edition_idx" ON "bottle_alias" USING btree ("edition_id");
CREATE INDEX "collection_bottle_edition_idx" ON "collection_bottle" USING btree ("edition_id");

ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_collection_id_bottle_id_edition_id_unique" UNIQUE NULLS NOT DISTINCT("collection_id","bottle_id","edition_id");
DROP INDEX "collection_bottle_unq";

ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_flight_id_bottle_id_edition_id_unique" UNIQUE NULLS NOT DISTINCT("flight_id","bottle_id","edition_id");
ALTER TABLE "flight_bottle" DROP CONSTRAINT "flight_bottle_flight_id_bottle_id";
