ALTER TABLE "bottle" ADD COLUMN "series" varchar(255);

UPDATE "bottle" SET "series" = (
  SELECT "series" FROM "tasting" WHERE "tasting"."bottle_id" = "bottle"."id" AND "series" IS NOT NULL LIMIT 1
) WHERE "series" IS NULL;
