ALTER TABLE "store_price_match_proposal" ADD COLUMN "processing_token" text;
ALTER TABLE "store_price_match_proposal" ADD COLUMN "processing_queued_at" timestamp;
ALTER TABLE "store_price_match_proposal" ADD COLUMN "processing_expires_at" timestamp;
CREATE INDEX "store_price_match_proposal_processing_expires_idx" ON "store_price_match_proposal" USING btree ("processing_expires_at");