ALTER TYPE "public"."scrape_source_run_purpose" ADD VALUE 'details';
ALTER TABLE "auction_lot" DROP COLUMN "last_seen_at";