CREATE TABLE "store_price_match_attempt" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"price_id" bigint NOT NULL,
	"proposal_id" bigint NOT NULL,
	"proposal_type" "store_price_match_proposal_type" NOT NULL,
	"initial_status" "store_price_match_proposal_status" NOT NULL,
	"final_status" "store_price_match_proposal_status",
	"confidence" integer,
	"current_bottle_id" bigint,
	"current_release_id" bigint,
	"suggested_bottle_id" bigint,
	"suggested_release_id" bigint,
	"parent_bottle_id" bigint,
	"creation_target" "store_price_match_creation_target",
	"automation_eligible" boolean DEFAULT false NOT NULL,
	"automation_score" integer,
	"model" text,
	"error" text,
	"reviewed_by_id" bigint,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_price_id_store_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."store_price"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_proposal_id_store_price_match_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."store_price_match_proposal"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_current_bottle_id_bottle_id_fk" FOREIGN KEY ("current_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_current_release_id_bottle_release_id_fk" FOREIGN KEY ("current_release_id") REFERENCES "public"."bottle_release"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_suggested_bottle_id_bottle_id_fk" FOREIGN KEY ("suggested_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_suggested_release_id_bottle_release_id_fk" FOREIGN KEY ("suggested_release_id") REFERENCES "public"."bottle_release"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_parent_bottle_id_bottle_id_fk" FOREIGN KEY ("parent_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "store_price_match_attempt_price_idx" ON "store_price_match_attempt" USING btree ("price_id");
CREATE INDEX "store_price_match_attempt_proposal_idx" ON "store_price_match_attempt" USING btree ("proposal_id");
CREATE INDEX "store_price_match_attempt_created_idx" ON "store_price_match_attempt" USING btree ("created_at");
CREATE INDEX "store_price_match_attempt_final_status_idx" ON "store_price_match_attempt" USING btree ("final_status");