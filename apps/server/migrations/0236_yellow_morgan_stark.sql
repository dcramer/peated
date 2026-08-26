ALTER TABLE "bottle" ADD COLUMN "bottling_year" smallint;
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_bottling_year_check" CHECK ("bottle"."bottling_year" IS NULL OR "bottle"."bottling_year" >= 1800);