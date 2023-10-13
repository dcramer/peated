ALTER TABLE "bottle" ADD COLUMN "avg_rating" double precision;

UPDATE "bottle" SET "avg_rating" = (SELECT AVG("rating") FROM "tasting" WHERE "tasting"."bottle_id" = "bottle"."id");
