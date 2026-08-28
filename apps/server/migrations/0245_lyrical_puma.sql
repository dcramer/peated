CREATE TYPE "public"."scrape_definition_manager" AS ENUM('code', 'admin');
ALTER TABLE "external_site_scrape_target" ADD COLUMN "managed_by" "scrape_definition_manager" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_origin" ADD COLUMN "managed_by" "scrape_definition_manager" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_target" ADD COLUMN "managed_by" "scrape_definition_manager" DEFAULT 'code' NOT NULL;
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_id_site_unq" UNIQUE("id","external_site_id");