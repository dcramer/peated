ALTER TABLE "edition" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "edition" ADD COLUMN "vintage_year" smallint;