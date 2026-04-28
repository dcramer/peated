CREATE TYPE "public"."store_price_match_retry_run_item_status" AS ENUM('pending', 'processing', 'completed', 'skipped', 'failed');
CREATE TYPE "public"."store_price_match_retry_run_kind" AS ENUM('create_new', 'match_existing', 'correction', 'errored');
CREATE TYPE "public"."store_price_match_retry_run_mode" AS ENUM('no_web', 'full');
CREATE TYPE "public"."store_price_match_retry_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'canceled');
CREATE TABLE "store_price_match_retry_run_item" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" bigint NOT NULL,
	"proposal_id" bigint NOT NULL,
	"price_id" bigint NOT NULL,
	"status" "store_price_match_retry_run_item_status" DEFAULT 'pending' NOT NULL,
	"result_status" "store_price_match_proposal_status",
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "store_price_match_retry_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"kind" "store_price_match_retry_run_kind",
	"mode" "store_price_match_retry_run_mode" DEFAULT 'no_web' NOT NULL,
	"status" "store_price_match_retry_run_status" DEFAULT 'pending' NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"resolved_count" integer DEFAULT 0 NOT NULL,
	"reviewable_count" integer DEFAULT 0 NOT NULL,
	"errored_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_by_id" bigint,
	"started_at" timestamp,
	"completed_at" timestamp,
	"cancel_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "store_price_match_retry_run_item" ADD CONSTRAINT "store_price_match_retry_run_item_run_id_store_price_match_retry_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."store_price_match_retry_run"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "store_price_match_retry_run_item" ADD CONSTRAINT "store_price_match_retry_run_item_proposal_id_store_price_match_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."store_price_match_proposal"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "store_price_match_retry_run_item" ADD CONSTRAINT "store_price_match_retry_run_item_price_id_store_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."store_price"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "store_price_match_retry_run" ADD CONSTRAINT "store_price_match_retry_run_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "store_price_match_retry_run_item_unq" ON "store_price_match_retry_run_item" USING btree ("run_id","proposal_id");
CREATE INDEX "store_price_match_retry_run_item_run_status_idx" ON "store_price_match_retry_run_item" USING btree ("run_id","status");
CREATE INDEX "store_price_match_retry_run_item_proposal_idx" ON "store_price_match_retry_run_item" USING btree ("proposal_id");
CREATE INDEX "store_price_match_retry_run_item_price_idx" ON "store_price_match_retry_run_item" USING btree ("price_id");
CREATE INDEX "store_price_match_retry_run_status_idx" ON "store_price_match_retry_run" USING btree ("status");
CREATE INDEX "store_price_match_retry_run_created_by_idx" ON "store_price_match_retry_run" USING btree ("created_by_id");
CREATE INDEX "store_price_match_retry_run_created_at_idx" ON "store_price_match_retry_run" USING btree ("created_at");