ALTER TABLE "collection_bottle" ADD COLUMN "id" bigserial NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "collection_bottle_unq" ON "collection_bottle" ("collection_id","bottle_id","edition_id");
