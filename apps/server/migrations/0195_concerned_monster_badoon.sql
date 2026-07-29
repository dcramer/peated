ALTER TABLE "collection_bottle" DROP CONSTRAINT "collection_bottle_collection_id_bottle_id_release_id_unique";
ALTER TABLE "flight_bottle" DROP CONSTRAINT "flight_bottle_flight_id_bottle_id_release_id_unique";
ALTER TABLE "tasting" DROP CONSTRAINT "tasting_unq";
ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_collection_id_bottle_id_unique" UNIQUE("collection_id","bottle_id");
ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_flight_id_bottle_id_unique" UNIQUE("flight_id","bottle_id");
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_unq" UNIQUE("bottle_id","created_by_id","created_at");