ALTER TABLE "collection_bottle" ADD COLUMN "vintage_fingerprint" varchar(128);
ALTER TABLE "collection_bottle" ADD COLUMN "series" varchar(255);
ALTER TABLE "collection_bottle" ADD COLUMN "vintage_year" smallint;
ALTER TABLE "collection_bottle" ADD COLUMN "barrel" smallint;
ALTER TABLE "collection" ADD COLUMN "total_bottles" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "tasting" ADD COLUMN "series" varchar(255);
ALTER TABLE "tasting" ADD COLUMN "vintage_year" smallint;
ALTER TABLE "tasting" ADD COLUMN "barrel" smallint;
ALTER TABLE "collection_bottle" DROP CONSTRAINT "collection_bottle_edition_id_edition_id_fk";

ALTER TABLE "tasting" DROP CONSTRAINT "tasting_edition_id_edition_id_fk";

ALTER TABLE "collection_bottle" DROP COLUMN IF EXISTS "edition_id";
ALTER TABLE "tasting" DROP COLUMN IF EXISTS "edition_id";
DROP TABLE edition;
UPDATE "collection" SET "total_bottles" = (SELECT COUNT(*) FROM "collection_bottle" WHERE "collection_bottle"."collection_id" = "collection"."id");
