CREATE TYPE "public"."bottle_check_close_reason" AS ENUM('dismissed', 'resolved_manually');
CREATE TYPE "public"."bottle_check_intent" AS ENUM('resolve_reference', 'audit_bottle');
CREATE TYPE "public"."bottle_check_origin" AS ENUM('moderator', 'post_user_creation');
CREATE TYPE "public"."bottle_operation_rejection_reason" AS ENUM('wrong_target', 'wrong_change', 'insufficient_evidence', 'resolved_manually', 'other');
CREATE TYPE "public"."bottle_operation_status" AS ENUM('blocked', 'pending_review', 'rejected', 'applying', 'applied', 'stale', 'failed');
CREATE TABLE "bottle_check" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"intent" "bottle_check_intent" NOT NULL,
	"origin" "bottle_check_origin",
	"source_kind" text,
	"source_id" text,
	"bottle_id" bigint,
	"subject_key" text NOT NULL,
	"background_event_key" text,
	"schema_version" integer NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"output" jsonb,
	"artifacts" jsonb,
	"model" text,
	"model_metadata" jsonb,
	"error" text,
	"store_price_match_proposal_id" bigint,
	"store_price_match_attempt_id" bigint,
	"closed_by_id" bigint,
	"close_reason" "bottle_check_close_reason",
	"close_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"closed_at" timestamp
);

CREATE TABLE "bottle_operation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"check_id" bigint NOT NULL,
	"proposal" jsonb NOT NULL,
	"resolved_evidence_refs" jsonb,
	"state_token" jsonb,
	"preparation_error" jsonb,
	"status" "bottle_operation_status" DEFAULT 'pending_review' NOT NULL,
	"reviewed_by_id" bigint,
	"reviewed_at" timestamp,
	"rejection_reason" "bottle_operation_rejection_reason",
	"reviewer_note" text,
	"result" jsonb,
	"error" text,
	"prepared_at" timestamp,
	"execution_started_at" timestamp,
	"execution_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "bottle_release_promotion" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "bottle_release" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_release_repair_review" DISABLE ROW LEVEL SECURITY;
DROP TABLE "bottle_release_promotion" CASCADE;
DROP TABLE "bottle_release" CASCADE;
DROP TABLE "legacy_release_repair_review" CASCADE;
ALTER TABLE "store_price_match_attempt" DROP CONSTRAINT "store_price_match_attempt_parent_bottle_id_bottle_id_fk";

ALTER TABLE "store_price_match_proposal" DROP CONSTRAINT "store_price_match_proposal_parent_bottle_id_bottle_id_fk";

DROP INDEX "bottle_alias_release_idx";
DROP INDEX "bottle_observation_release_idx";
DROP INDEX "collection_bottle_release_idx";
DROP INDEX "flight_bottle_release_idx";
DROP INDEX "incoming_bottle_decision_release_idx";
DROP INDEX "review_release_idx";
DROP INDEX "store_price_match_proposal_current_release_idx";
DROP INDEX "store_price_match_proposal_suggested_release_idx";
DROP INDEX "store_price_match_proposal_parent_bottle_idx";
DROP INDEX "store_price_release_idx";
DROP INDEX "tasting_release_idx";
ALTER TABLE "bottle_check" ADD CONSTRAINT "bottle_check_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle_check" ADD CONSTRAINT "bottle_check_store_price_match_proposal_id_store_price_match_proposal_id_fk" FOREIGN KEY ("store_price_match_proposal_id") REFERENCES "public"."store_price_match_proposal"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle_check" ADD CONSTRAINT "bottle_check_store_price_match_attempt_id_store_price_match_attempt_id_fk" FOREIGN KEY ("store_price_match_attempt_id") REFERENCES "public"."store_price_match_attempt"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle_check" ADD CONSTRAINT "bottle_check_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle_operation" ADD CONSTRAINT "bottle_operation_check_id_bottle_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."bottle_check"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_operation" ADD CONSTRAINT "bottle_operation_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "bottle_check_subject_created_idx" ON "bottle_check" USING btree ("subject_key","created_at");
CREATE INDEX "bottle_check_bottle_idx" ON "bottle_check" USING btree ("bottle_id");
CREATE INDEX "bottle_check_source_idx" ON "bottle_check" USING btree ("source_kind","source_id");
CREATE UNIQUE INDEX "bottle_check_background_event_unq" ON "bottle_check" USING btree ("background_event_key");
CREATE INDEX "bottle_check_store_price_proposal_idx" ON "bottle_check" USING btree ("store_price_match_proposal_id");
CREATE INDEX "bottle_check_store_price_attempt_idx" ON "bottle_check" USING btree ("store_price_match_attempt_id");
CREATE INDEX "bottle_check_closed_idx" ON "bottle_check" USING btree ("closed_at");
CREATE INDEX "bottle_operation_check_idx" ON "bottle_operation" USING btree ("check_id");
CREATE INDEX "bottle_operation_status_idx" ON "bottle_operation" USING btree ("status");
CREATE INDEX "bottle_operation_reviewer_idx" ON "bottle_operation" USING btree ("reviewed_by_id");
ALTER TABLE "bottle_alias" DROP COLUMN "release_id";
ALTER TABLE "bottle_observation" DROP COLUMN "release_id";
ALTER TABLE "collection_bottle" DROP COLUMN "release_id";
ALTER TABLE "flight_bottle" DROP COLUMN "release_id";
ALTER TABLE "incoming_bottle_decision_log" DROP COLUMN "release_id";
ALTER TABLE "review" DROP COLUMN "release_id";
ALTER TABLE "store_price_match_attempt" DROP COLUMN "current_release_id";
ALTER TABLE "store_price_match_attempt" DROP COLUMN "suggested_release_id";
ALTER TABLE "store_price_match_attempt" DROP COLUMN "parent_bottle_id";
ALTER TABLE "store_price_match_attempt" DROP COLUMN "creation_target";
ALTER TABLE "store_price_match_proposal" DROP COLUMN "current_release_id";
ALTER TABLE "store_price_match_proposal" DROP COLUMN "suggested_release_id";
ALTER TABLE "store_price_match_proposal" DROP COLUMN "parent_bottle_id";
ALTER TABLE "store_price_match_proposal" DROP COLUMN "creation_target";
ALTER TABLE "store_price_match_proposal" DROP COLUMN "proposed_release";
ALTER TABLE "store_price" DROP COLUMN "release_id";
ALTER TABLE "tasting" DROP COLUMN "release_id";
DROP TYPE "public"."legacy_release_repair_review_resolution";
DROP TYPE "public"."store_price_match_creation_target";