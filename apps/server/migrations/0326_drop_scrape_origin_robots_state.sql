ALTER TABLE "scrape_origin" DROP CONSTRAINT "scrape_origin_robots_cache_check";
ALTER TABLE "scrape_origin" DROP COLUMN "robots_state";
ALTER TABLE "scrape_origin" DROP COLUMN "robots_fetched_at";
ALTER TABLE "scrape_origin" DROP COLUMN "robots_expires_at";