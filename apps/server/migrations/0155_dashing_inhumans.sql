ALTER TABLE "bottle_edition" RENAME TO "bottle_release";
ALTER TABLE "bottle_alias" RENAME COLUMN "edition_id" TO "release_id";
ALTER TABLE "collection_bottle" RENAME COLUMN "edition_id" TO "release_id";
ALTER TABLE "flight_bottle" RENAME COLUMN "edition_id" TO "release_id";
ALTER TABLE "tasting" RENAME COLUMN "edition_id" TO "release_id";
ALTER TABLE "collection_bottle" DROP CONSTRAINT "collection_bottle_collection_id_bottle_id_edition_id_unique";
ALTER TABLE "flight_bottle" DROP CONSTRAINT "flight_bottle_flight_id_bottle_id_edition_id_unique";
ALTER TABLE "tasting" DROP CONSTRAINT "tasting_unq";
ALTER TABLE "bottle_alias" DROP CONSTRAINT "bottle_alias_edition_id_bottle_edition_id_fk";

ALTER TABLE "bottle_release" DROP CONSTRAINT "bottle_edition_bottle_id_bottle_id_fk";

ALTER TABLE "bottle_release" DROP CONSTRAINT "bottle_edition_created_by_id_user_id_fk";

ALTER TABLE "collection_bottle" DROP CONSTRAINT "collection_bottle_edition_id_bottle_edition_id_fk";

ALTER TABLE "flight_bottle" DROP CONSTRAINT "flight_bottle_edition_id_bottle_edition_id_fk";

ALTER TABLE "tasting" DROP CONSTRAINT "tasting_edition_id_bottle_edition_id_fk";

DROP INDEX "bottle_alias_edition_idx";
DROP INDEX "bottle_edition_bottle_idx";
DROP INDEX "bottle_edition_created_by_idx";
DROP INDEX "bottle_edition_full_name_idx";
DROP INDEX "collection_bottle_edition_idx";
DROP INDEX "tasting_edition_idx";
ALTER TABLE "bottle_release" ADD COLUMN "search_vector" "tsvector";
ALTER TABLE "bottle_release" ADD COLUMN "edition" varchar(255);
ALTER TABLE "bottle" ADD COLUMN "series" varchar(255);
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release" ADD CONSTRAINT "bottle_release_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_release" ADD CONSTRAINT "bottle_release_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_alias_release_idx" ON "bottle_alias" USING btree ("release_id");
CREATE INDEX "bottle_release_bottle_idx" ON "bottle_release" USING btree ("bottle_id");
CREATE INDEX "bottle_release_created_by_idx" ON "bottle_release" USING btree ("created_by_id");
CREATE UNIQUE INDEX "bottle_release_full_name_idx" ON "bottle_release" USING btree ("full_name");
CREATE INDEX "collection_bottle_release_idx" ON "collection_bottle" USING btree ("release_id");
CREATE INDEX "tasting_release_idx" ON "tasting" USING btree ("release_id");
ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_collection_id_bottle_id_release_id_unique" UNIQUE NULLS NOT DISTINCT("collection_id","bottle_id","release_id");
ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_flight_id_bottle_id_release_id_unique" UNIQUE NULLS NOT DISTINCT("flight_id","bottle_id","release_id");
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_unq" UNIQUE NULLS NOT DISTINCT("bottle_id","release_id","created_by_id","created_at");