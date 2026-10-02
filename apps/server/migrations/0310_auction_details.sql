ALTER TYPE "public"."scrape_source_run_purpose" ADD VALUE 'details';
ALTER TABLE "auction_lot" ADD COLUMN "source_details_requested_at" timestamp with time zone;
ALTER TABLE "auction_lot" ADD COLUMN "source_details_checked_at" timestamp with time zone;
ALTER TABLE "auction_lot" ADD COLUMN "source_details_run_id" bigint;
ALTER TABLE "auction_lot" ADD CONSTRAINT "auction_lot_source_details_run_id_external_site_run_id_fk" FOREIGN KEY ("source_details_run_id") REFERENCES "public"."external_site_run"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_lot" DROP COLUMN "last_seen_at";