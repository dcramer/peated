DO $$ BEGIN
 CREATE TYPE "servingStyle" AS ENUM('neat', 'rocks', 'splash');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "tasting" ADD COLUMN "serving_style" "servingStyle";