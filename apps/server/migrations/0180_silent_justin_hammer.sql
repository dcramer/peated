CREATE TYPE "public"."incoming_bottle_decision_actor_type" AS ENUM('system', 'user');
CREATE TYPE "public"."incoming_bottle_decision_source_kind" AS ENUM('review', 'store_price');
CREATE TYPE "public"."incoming_bottle_decision_type" AS ENUM('match_existing', 'create_bottle', 'create_release', 'create_bottle_and_release');
CREATE TABLE "incoming_bottle_decision_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_kind" "incoming_bottle_decision_source_kind" NOT NULL,
	"source_id" bigint NOT NULL,
	"proposal_id" bigint,
	"external_site_id" bigint NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"decision" "incoming_bottle_decision_type" NOT NULL,
	"actor_type" "incoming_bottle_decision_actor_type" NOT NULL,
	"actor_user_id" bigint,
	"bottle_id" bigint NOT NULL,
	"release_id" bigint,
	"created_bottle" boolean DEFAULT false NOT NULL,
	"created_release" boolean DEFAULT false NOT NULL,
	"confidence" integer,
	"model" text,
	"rationale" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_proposal_id_store_price_match_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."store_price_match_proposal"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "incoming_bottle_decision_source_unq" ON "incoming_bottle_decision_log" USING btree ("source_kind","source_id");
CREATE INDEX "incoming_bottle_decision_created_idx" ON "incoming_bottle_decision_log" USING btree ("created_at");
CREATE INDEX "incoming_bottle_decision_external_site_idx" ON "incoming_bottle_decision_log" USING btree ("external_site_id");
CREATE INDEX "incoming_bottle_decision_bottle_idx" ON "incoming_bottle_decision_log" USING btree ("bottle_id");
CREATE INDEX "incoming_bottle_decision_release_idx" ON "incoming_bottle_decision_log" USING btree ("release_id");
CREATE INDEX "incoming_bottle_decision_actor_idx" ON "incoming_bottle_decision_log" USING btree ("actor_type");
CREATE INDEX "incoming_bottle_decision_actor_user_idx" ON "incoming_bottle_decision_log" USING btree ("actor_user_id");