ALTER TABLE "tasting" DROP CONSTRAINT "tasting_unq";
ALTER TABLE "tasting" ALTER COLUMN "tasted_at" SET NOT NULL;
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_unq" UNIQUE("bottle_id","created_by_id","tasted_at");