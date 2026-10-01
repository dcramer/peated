ALTER TYPE "public"."incoming_bottle_decision_type" ADD VALUE 'unassign';
DROP INDEX "incoming_bottle_decision_source_unq";
ALTER TABLE "review" ADD COLUMN "matched_reference_id" bigint;
ALTER TABLE "store_price" ADD COLUMN "matched_reference_id" bigint;
ALTER TABLE "review" ADD CONSTRAINT "review_matched_reference_id_bottle_reference_id_fk" FOREIGN KEY ("matched_reference_id") REFERENCES "public"."bottle_reference"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price" ADD CONSTRAINT "store_price_matched_reference_id_bottle_reference_id_fk" FOREIGN KEY ("matched_reference_id") REFERENCES "public"."bottle_reference"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "incoming_bottle_decision_source_idx" ON "incoming_bottle_decision_log" USING btree ("source_kind","source_id");