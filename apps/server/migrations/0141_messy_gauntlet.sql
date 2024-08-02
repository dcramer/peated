DO $$ BEGIN
 CREATE TYPE "public"."badge_formula" AS ENUM('default', 'linear');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "badges" ADD COLUMN "formula" "badge_formula" DEFAULT 'default' NOT NULL;