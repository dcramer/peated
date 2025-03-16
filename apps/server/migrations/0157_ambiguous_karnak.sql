ALTER TABLE "bottle" ADD COLUMN "expression" varchar(255);
UPDATE "bottle" SET "expression" = "name";
ALTER TABLE "bottle" ADD COLUMN "series" varchar(255);
ALTER TABLE "bottle_release" DROP COLUMN "series";
