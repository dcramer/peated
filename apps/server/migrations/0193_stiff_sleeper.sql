CREATE TYPE "public"."bottle_release_promotion_status" AS ENUM('pending', 'promoted', 'failed');
CREATE TABLE "bottle_group_distiller" (
	"group_id" bigint NOT NULL,
	"distiller_id" bigint NOT NULL,
	CONSTRAINT "bottle_group_distiller_group_id_distiller_id_pk" PRIMARY KEY("group_id","distiller_id")
);

CREATE TABLE "bottle_group_tombstone" (
	"bottle_group_id" bigint PRIMARY KEY NOT NULL,
	"new_bottle_group_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_actor_id" bigint NOT NULL
);

CREATE TABLE "bottle_group" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"stated_age" smallint,
	"series_id" bigint,
	"category" "category",
	"brand_id" bigint NOT NULL,
	"bottler_id" bigint,
	"flavor_profile" "flavor_profile",
	"representative_bottle_id" bigint,
	"description" text,
	"description_src" "content_source",
	"image_url" text,
	"tasting_notes" jsonb,
	"suggested_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL,
	"avg_rating" double precision,
	"rating_stats" jsonb DEFAULT '{"pass":0,"sip":0,"savor":0,"total":0,"avg":null,"percentage":{"pass":0,"sip":0,"savor":0}}'::jsonb NOT NULL,
	"total_tastings" bigint DEFAULT 0 NOT NULL,
	"total_bottles" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	CONSTRAINT "bottle_group_stated_age_check" CHECK ("bottle_group"."stated_age" IS NULL OR ("bottle_group"."stated_age" >= 0 AND "bottle_group"."stated_age" <= 100))
);

CREATE TABLE "bottle_release_promotion" (
	"release_id" bigint PRIMARY KEY NOT NULL,
	"promoted_bottle_id" bigint,
	"status" "bottle_release_promotion_status" DEFAULT 'pending' NOT NULL,
	"audit_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_actor_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "catalog_target" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_group_id" bigint NOT NULL,
	"bottle_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "bottle_alias" ADD COLUMN "target_id" bigint;
ALTER TABLE "bottle_observation" ADD COLUMN "target_id" bigint;
ALTER TABLE "bottle" ADD COLUMN "group_id" bigint;
ALTER TABLE "collection_bottle" ADD COLUMN "target_id" bigint;
ALTER TABLE "flight_bottle" ADD COLUMN "target_id" bigint;
ALTER TABLE "incoming_bottle_decision_log" ADD COLUMN "target_id" bigint;
ALTER TABLE "review" ADD COLUMN "target_id" bigint;
ALTER TABLE "store_price_match_attempt" ADD COLUMN "current_target_id" bigint;
ALTER TABLE "store_price_match_attempt" ADD COLUMN "suggested_target_id" bigint;
ALTER TABLE "store_price_match_proposal" ADD COLUMN "current_target_id" bigint;
ALTER TABLE "store_price_match_proposal" ADD COLUMN "suggested_target_id" bigint;
ALTER TABLE "store_price" ADD COLUMN "target_id" bigint;
ALTER TABLE "tasting" ADD COLUMN "target_id" bigint;
ALTER TABLE "bottle_group_distiller" ADD CONSTRAINT "bottle_group_distiller_group_id_bottle_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group_distiller" ADD CONSTRAINT "bottle_group_distiller_distiller_id_entity_id_fk" FOREIGN KEY ("distiller_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group_tombstone" ADD CONSTRAINT "bottle_group_tombstone_new_bottle_group_id_bottle_group_id_fk" FOREIGN KEY ("new_bottle_group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group_tombstone" ADD CONSTRAINT "bottle_group_tombstone_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_series_id_bottle_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."bottle_series"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_brand_id_entity_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_bottler_id_entity_id_fk" FOREIGN KEY ("bottler_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release_promotion" ADD CONSTRAINT "bottle_release_promotion_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release_promotion" ADD CONSTRAINT "bottle_release_promotion_promoted_bottle_id_bottle_id_fk" FOREIGN KEY ("promoted_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release_promotion" ADD CONSTRAINT "bottle_release_promotion_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "catalog_target" ADD CONSTRAINT "catalog_target_bottle_group_id_bottle_group_id_fk" FOREIGN KEY ("bottle_group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_group_tombstone_new_group_idx" ON "bottle_group_tombstone" USING btree ("new_bottle_group_id");
CREATE INDEX "bottle_group_tombstone_created_by_actor_idx" ON "bottle_group_tombstone" USING btree ("created_by_actor_id");
CREATE INDEX "bottle_group_brand_idx" ON "bottle_group" USING btree ("brand_id");
CREATE INDEX "bottle_group_bottler_idx" ON "bottle_group" USING btree ("bottler_id");
CREATE INDEX "bottle_group_series_idx" ON "bottle_group" USING btree ("series_id");
CREATE INDEX "bottle_group_category_idx" ON "bottle_group" USING btree ("category");
CREATE INDEX "bottle_group_representative_bottle_idx" ON "bottle_group" USING btree ("representative_bottle_id");
CREATE INDEX "bottle_group_created_by_actor_idx" ON "bottle_group" USING btree ("created_by_actor_id");
CREATE UNIQUE INDEX "bottle_release_promotion_bottle_unq" ON "bottle_release_promotion" USING btree ("promoted_bottle_id");
CREATE INDEX "bottle_release_promotion_status_idx" ON "bottle_release_promotion" USING btree ("status");
CREATE INDEX "bottle_release_promotion_created_by_actor_idx" ON "bottle_release_promotion" USING btree ("created_by_actor_id");
CREATE UNIQUE INDEX "catalog_target_generic_group_unq" ON "catalog_target" USING btree ("bottle_group_id") WHERE "catalog_target"."bottle_id" IS NULL;
CREATE UNIQUE INDEX "catalog_target_bottle_unq" ON "catalog_target" USING btree ("bottle_id");
CREATE INDEX "catalog_target_group_idx" ON "catalog_target" USING btree ("bottle_group_id");
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_observation" ADD CONSTRAINT "bottle_observation_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_group_id_bottle_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "review" ADD CONSTRAINT "review_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_current_target_id_catalog_target_id_fk" FOREIGN KEY ("current_target_id") REFERENCES "public"."catalog_target"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_attempt" ADD CONSTRAINT "store_price_match_attempt_suggested_target_id_catalog_target_id_fk" FOREIGN KEY ("suggested_target_id") REFERENCES "public"."catalog_target"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "store_price_match_proposal" ADD CONSTRAINT "store_price_match_proposal_current_target_id_catalog_target_id_fk" FOREIGN KEY ("current_target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "store_price_match_proposal" ADD CONSTRAINT "store_price_match_proposal_suggested_target_id_catalog_target_id_fk" FOREIGN KEY ("suggested_target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "store_price" ADD CONSTRAINT "store_price_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_target_id_catalog_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."catalog_target"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_alias_target_idx" ON "bottle_alias" USING btree ("target_id");
CREATE INDEX "bottle_observation_target_idx" ON "bottle_observation" USING btree ("target_id");
CREATE INDEX "bottle_group_idx" ON "bottle" USING btree ("group_id");
CREATE INDEX "collection_bottle_target_idx" ON "collection_bottle" USING btree ("target_id");
CREATE INDEX "flight_bottle_target_idx" ON "flight_bottle" USING btree ("target_id");
CREATE INDEX "incoming_bottle_decision_target_idx" ON "incoming_bottle_decision_log" USING btree ("target_id");
CREATE INDEX "review_target_idx" ON "review" USING btree ("target_id");
CREATE INDEX "store_price_match_attempt_current_target_idx" ON "store_price_match_attempt" USING btree ("current_target_id");
CREATE INDEX "store_price_match_attempt_suggested_target_idx" ON "store_price_match_attempt" USING btree ("suggested_target_id");
CREATE INDEX "store_price_match_proposal_current_target_idx" ON "store_price_match_proposal" USING btree ("current_target_id");
CREATE INDEX "store_price_match_proposal_suggested_target_idx" ON "store_price_match_proposal" USING btree ("suggested_target_id");
CREATE INDEX "store_price_target_idx" ON "store_price" USING btree ("target_id");
CREATE INDEX "tasting_target_idx" ON "tasting" USING btree ("target_id");
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_id_group_id_unq" UNIQUE("id","group_id");