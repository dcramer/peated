CREATE TYPE "public"."store_price_match_proposal_status" AS ENUM('verified', 'pending_review', 'approved', 'ignored', 'errored');
CREATE TYPE "public"."store_price_match_proposal_type" AS ENUM('match_existing', 'create_new', 'correction', 'no_match');
CREATE TABLE "store_price_match_proposal" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"price_id" bigint NOT NULL,
	"status" "store_price_match_proposal_status" DEFAULT 'pending_review' NOT NULL,
	"proposal_type" "store_price_match_proposal_type" NOT NULL,
	"confidence" integer,
	"current_bottle_id" bigint,
	"suggested_bottle_id" bigint,
	"candidate_bottles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_label" jsonb,
	"proposed_bottle" jsonb,
	"search_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rationale" text,
	"model" text,
	"error" text,
	"last_evaluated_at" timestamp,
	"reviewed_by_id" bigint,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "store_price_match_proposal" ADD CONSTRAINT "store_price_match_proposal_price_id_store_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."store_price"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "store_price_match_proposal" ADD CONSTRAINT "store_price_match_proposal_current_bottle_id_bottle_id_fk" FOREIGN KEY ("current_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "store_price_match_proposal" ADD CONSTRAINT "store_price_match_proposal_suggested_bottle_id_bottle_id_fk" FOREIGN KEY ("suggested_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "store_price_match_proposal" ADD CONSTRAINT "store_price_match_proposal_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "store_price_match_proposal_price_idx" ON "store_price_match_proposal" USING btree ("price_id");
CREATE INDEX "store_price_match_proposal_status_idx" ON "store_price_match_proposal" USING btree ("status");
CREATE INDEX "store_price_match_proposal_type_idx" ON "store_price_match_proposal" USING btree ("proposal_type");
CREATE INDEX "store_price_match_proposal_current_bottle_idx" ON "store_price_match_proposal" USING btree ("current_bottle_id");
CREATE INDEX "store_price_match_proposal_suggested_bottle_idx" ON "store_price_match_proposal" USING btree ("suggested_bottle_id");
CREATE INDEX "store_price_match_proposal_reviewed_by_idx" ON "store_price_match_proposal" USING btree ("reviewed_by_id");