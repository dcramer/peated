ALTER TABLE "bottle" RENAME COLUMN "cask_type" TO "maturation";
ALTER TABLE "bottle" ADD COLUMN "cask_number" varchar(255);
ALTER TABLE "bottle" ADD COLUMN "outturn" integer;
ALTER TABLE "bottle" DROP COLUMN "cask_size";
ALTER TABLE "bottle" DROP COLUMN "cask_fill";