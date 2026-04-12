CREATE TYPE "public"."legacy_release_repair_review_resolution" AS ENUM('allow_create_parent', 'blocked', 'reuse_existing_parent');
CREATE TABLE "legacy_release_repair_review" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"legacy_bottle_id" bigint NOT NULL,
	"proposed_parent_full_name" varchar(255) NOT NULL,
	"release_edition" varchar(255),
	"release_year" integer,
	"resolution" "legacy_release_repair_review_resolution" NOT NULL,
	"reviewed_parent_bottle_id" bigint,
	"blocked_reason" text,
	"review_version" integer DEFAULT 1 NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "legacy_release_repair_review" ADD CONSTRAINT "legacy_release_repair_review_legacy_bottle_id_bottle_id_fk" FOREIGN KEY ("legacy_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_release_repair_review" ADD CONSTRAINT "legacy_release_repair_review_reviewed_parent_bottle_id_bottle_id_fk" FOREIGN KEY ("reviewed_parent_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "legacy_release_repair_review_bottle_idx" ON "legacy_release_repair_review" USING btree ("legacy_bottle_id");
CREATE INDEX "legacy_release_repair_review_parent_idx" ON "legacy_release_repair_review" USING btree ("reviewed_parent_bottle_id");
CREATE INDEX "legacy_release_repair_review_resolution_idx" ON "legacy_release_repair_review" USING btree ("resolution");