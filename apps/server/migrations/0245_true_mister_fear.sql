CREATE TYPE "public"."scrape_definition_manager" AS ENUM('code', 'admin');
CREATE TYPE "public"."scrape_source_kind" AS ENUM('review', 'price');
CREATE TYPE "public"."scrape_source_preview_status" AS ENUM('pending', 'passed', 'failed');
CREATE TYPE "public"."scrape_source_revision_author" AS ENUM('person', 'ai');
CREATE TYPE "public"."scrape_source_run_purpose" AS ENUM('collect', 'preview', 'suggest');
CREATE TABLE "scrape_source_revision" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scrape_source_id" bigint NOT NULL,
	"revision" integer NOT NULL,
	"rules_version" integer NOT NULL,
	"list_url" text NOT NULL,
	"rules" jsonb NOT NULL,
	"author" "scrape_source_revision_author" NOT NULL,
	"ai_model" text,
	"ai_instructions_version" text,
	"active" boolean DEFAULT false NOT NULL,
	"preview_status" "scrape_source_preview_status" DEFAULT 'pending' NOT NULL,
	"preview_result" jsonb NOT NULL,
	"previewed_at" timestamp,
	"created_by_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scrape_source_revision_id_source_unq" UNIQUE("id","scrape_source_id"),
	CONSTRAINT "scrape_source_revision_numbers_check" CHECK ("scrape_source_revision"."revision" > 0 AND "scrape_source_revision"."rules_version" > 0),
	CONSTRAINT "scrape_source_revision_ai_details_check" CHECK (("scrape_source_revision"."author" = 'person' AND "scrape_source_revision"."ai_model" IS NULL AND "scrape_source_revision"."ai_instructions_version" IS NULL)
        OR ("scrape_source_revision"."author" = 'ai' AND "scrape_source_revision"."ai_model" IS NOT NULL AND "scrape_source_revision"."ai_instructions_version" IS NOT NULL))
);

CREATE TABLE "scrape_source_run" (
	"external_site_run_id" bigint PRIMARY KEY NOT NULL,
	"scrape_source_id" bigint NOT NULL,
	"revision_id" bigint,
	"purpose" "scrape_source_run_purpose" NOT NULL,
	CONSTRAINT "scrape_source_run_revision_check" CHECK ("scrape_source_run"."purpose" = 'suggest' OR "scrape_source_run"."revision_id" IS NOT NULL)
);

CREATE TABLE "scrape_source" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"kind" "scrape_source_kind" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"allow_ai_suggestions" boolean DEFAULT false NOT NULL,
	"list_url" text NOT NULL,
	"sample_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "external_site_scrape_target" ADD COLUMN "managed_by" "scrape_definition_manager" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_origin" ADD COLUMN "managed_by" "scrape_definition_manager" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_target" ADD COLUMN "managed_by" "scrape_definition_manager" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_source_revision" ADD CONSTRAINT "scrape_source_revision_scrape_source_id_scrape_source_id_fk" FOREIGN KEY ("scrape_source_id") REFERENCES "public"."scrape_source"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scrape_source_revision" ADD CONSTRAINT "scrape_source_revision_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "scrape_source_run" ADD CONSTRAINT "scrape_source_run_external_site_run_id_external_site_run_id_fk" FOREIGN KEY ("external_site_run_id") REFERENCES "public"."external_site_run"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scrape_source_run" ADD CONSTRAINT "scrape_source_run_scrape_source_id_scrape_source_id_fk" FOREIGN KEY ("scrape_source_id") REFERENCES "public"."scrape_source"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scrape_source_run" ADD CONSTRAINT "scrape_source_run_revision_fk" FOREIGN KEY ("revision_id","scrape_source_id") REFERENCES "public"."scrape_source_revision"("id","scrape_source_id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "scrape_source" ADD CONSTRAINT "scrape_source_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scrape_source" ADD CONSTRAINT "scrape_source_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "scrape_source_revision_number_unq" ON "scrape_source_revision" USING btree ("scrape_source_id","revision");
CREATE UNIQUE INDEX "scrape_source_revision_active_unq" ON "scrape_source_revision" USING btree ("scrape_source_id") WHERE "scrape_source_revision"."active" = true;
CREATE INDEX "scrape_source_run_source_revision_idx" ON "scrape_source_run" USING btree ("scrape_source_id","revision_id");
CREATE UNIQUE INDEX "scrape_source_site_unq" ON "scrape_source" USING btree ("external_site_id");