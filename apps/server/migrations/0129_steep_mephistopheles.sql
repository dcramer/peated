ALTER TABLE "bottle" ADD COLUMN "release_year" smallint;
UPDATE "bottle" SET "release_year" = date_part('year', "release_date") WHERE "release_date" IS NOT NULL;
ALTER TABLE "bottle" DROP COLUMN IF EXISTS "release_date";
