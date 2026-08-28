CREATE TYPE "public"."configured_scraper_collection" AS ENUM('reviews', 'store_prices');
CREATE TYPE "public"."configured_scraper_run_purpose" AS ENUM('collect', 'preview');
CREATE TYPE "public"."configured_scraper_validation_status" AS ENUM('pending', 'passed', 'failed');
CREATE TYPE "public"."configured_scraper_version_origin" AS ENUM('manual', 'llm');
CREATE TYPE "public"."scrape_definition_owner" AS ENUM('code', 'admin');
CREATE TABLE "configured_scraper_config_version" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"configured_scraper_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"origin" "configured_scraper_version_origin" NOT NULL,
	"model" text,
	"prompt_version" text,
	"engine_version" integer NOT NULL,
	"validation_status" "configured_scraper_validation_status" DEFAULT 'pending' NOT NULL,
	"validation_result" jsonb NOT NULL,
	"validated_at" timestamp,
	"created_by_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configured_scraper_config_version_number_check" CHECK ("configured_scraper_config_version"."version" > 0 AND "configured_scraper_config_version"."engine_version" > 0),
	CONSTRAINT "configured_scraper_config_version_llm_metadata_check" CHECK (("configured_scraper_config_version"."origin" = 'manual' AND "configured_scraper_config_version"."model" IS NULL AND "configured_scraper_config_version"."prompt_version" IS NULL)
        OR ("configured_scraper_config_version"."origin" = 'llm' AND "configured_scraper_config_version"."model" IS NOT NULL AND "configured_scraper_config_version"."prompt_version" IS NOT NULL))
);

CREATE TABLE "configured_scraper_run" (
	"external_site_run_id" bigint PRIMARY KEY NOT NULL,
	"configured_scraper_id" bigint NOT NULL,
	"config_version_id" bigint NOT NULL,
	"purpose" "configured_scraper_run_purpose" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "configured_scraper" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"collection" "configured_scraper_collection" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"allow_llm_processing" boolean DEFAULT false NOT NULL,
	"index_url" text NOT NULL,
	"sample_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_every" integer,
	"next_run_at" timestamp,
	"active_config_version_id" bigint,
	"created_by_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configured_scraper_run_every_check" CHECK ("configured_scraper"."run_every" IS NULL OR "configured_scraper"."run_every" > 0)
);

ALTER TABLE "external_site_scrape_target" ADD COLUMN "owner" "scrape_definition_owner" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_origin" ADD COLUMN "owner" "scrape_definition_owner" DEFAULT 'code' NOT NULL;
ALTER TABLE "scrape_target" ADD COLUMN "owner" "scrape_definition_owner" DEFAULT 'code' NOT NULL;
ALTER TABLE "configured_scraper_config_version" ADD CONSTRAINT "configured_scraper_config_version_configured_scraper_id_configured_scraper_id_fk" FOREIGN KEY ("configured_scraper_id") REFERENCES "public"."configured_scraper"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "configured_scraper_config_version" ADD CONSTRAINT "configured_scraper_config_version_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "configured_scraper_run" ADD CONSTRAINT "configured_scraper_run_external_site_run_id_external_site_run_id_fk" FOREIGN KEY ("external_site_run_id") REFERENCES "public"."external_site_run"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "configured_scraper_run" ADD CONSTRAINT "configured_scraper_run_configured_scraper_id_configured_scraper_id_fk" FOREIGN KEY ("configured_scraper_id") REFERENCES "public"."configured_scraper"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "configured_scraper_run" ADD CONSTRAINT "configured_scraper_run_config_version_id_configured_scraper_config_version_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."configured_scraper_config_version"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "configured_scraper" ADD CONSTRAINT "configured_scraper_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "configured_scraper" ADD CONSTRAINT "configured_scraper_active_config_version_id_configured_scraper_config_version_id_fk" FOREIGN KEY ("active_config_version_id") REFERENCES "public"."configured_scraper_config_version"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "configured_scraper" ADD CONSTRAINT "configured_scraper_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "configured_scraper_config_version_unq" ON "configured_scraper_config_version" USING btree ("configured_scraper_id","version");
CREATE INDEX "configured_scraper_config_version_created_idx" ON "configured_scraper_config_version" USING btree ("configured_scraper_id","created_at");
CREATE INDEX "configured_scraper_run_config_idx" ON "configured_scraper_run" USING btree ("configured_scraper_id","config_version_id");
CREATE UNIQUE INDEX "configured_scraper_site_collection_unq" ON "configured_scraper" USING btree ("external_site_id","collection");