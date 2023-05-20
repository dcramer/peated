ALTER TABLE "collection_bottle" DROP CONSTRAINT "collection_bottle_collection_id_bottle_id_edition_id";
ALTER TABLE "collection_bottle" ADD PRIMARY KEY (id);
ALTER TABLE "collection_bottle" ALTER COLUMN "edition_id" DROP NOT NULL;
