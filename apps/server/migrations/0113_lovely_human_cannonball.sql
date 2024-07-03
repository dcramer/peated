ALTER TABLE "bottle" ADD COLUMN "vintage_year" smallint;
ALTER TABLE "bottle" ADD COLUMN "cask_size" varchar(255);
ALTER TABLE "bottle" ADD COLUMN "cask_type" varchar(255);
ALTER TABLE "bottle" ADD COLUMN "cask_fill" varchar(255);
ALTER TABLE "bottle" ADD COLUMN "release_date" timestamp;