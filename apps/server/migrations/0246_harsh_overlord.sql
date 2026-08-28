ALTER TYPE "public"."configured_scraper_run_purpose" ADD VALUE 'generate';
ALTER TABLE "configured_scraper_run" ALTER COLUMN "config_version_id" DROP NOT NULL;
ALTER TABLE "configured_scraper_run" ADD CONSTRAINT "configured_scraper_run_version_check" CHECK (("configured_scraper_run"."purpose"::text = 'generate' AND "configured_scraper_run"."config_version_id" IS NULL)
        OR ("configured_scraper_run"."purpose"::text <> 'generate' AND "configured_scraper_run"."config_version_id" IS NOT NULL));