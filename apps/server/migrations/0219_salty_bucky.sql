CREATE TYPE "public"."scrape_origin_robots_mode" AS ENUM('enforce', 'not_applicable');
CREATE TABLE "external_site_scrape_target" (
	"external_site_id" bigint NOT NULL,
	"target_key" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_site_scrape_target_external_site_id_target_key_pk" PRIMARY KEY("external_site_id","target_key")
);

CREATE TABLE "scrape_origin" (
	"origin" text PRIMARY KEY NOT NULL,
	"target_key" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"robots_mode" "scrape_origin_robots_mode" NOT NULL,
	"robots_rationale" text,
	"robots_state" jsonb,
	"robots_fetched_at" timestamp,
	"robots_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scrape_origin_value_check" CHECK ("scrape_origin"."origin" ~ '^https?://[^/]+$'),
	CONSTRAINT "scrape_origin_robots_rationale_check" CHECK (("scrape_origin"."robots_mode" = 'enforce' AND "scrape_origin"."robots_rationale" IS NULL)
        OR ("scrape_origin"."robots_mode" = 'not_applicable' AND "scrape_origin"."robots_rationale" IS NOT NULL)),
	CONSTRAINT "scrape_origin_robots_cache_check" CHECK (("scrape_origin"."robots_state" IS NULL
          AND "scrape_origin"."robots_fetched_at" IS NULL
          AND "scrape_origin"."robots_expires_at" IS NULL)
        OR ("scrape_origin"."robots_state" IS NOT NULL
          AND "scrape_origin"."robots_fetched_at" IS NOT NULL
          AND "scrape_origin"."robots_expires_at" IS NOT NULL
          AND "scrape_origin"."robots_expires_at" > "scrape_origin"."robots_fetched_at"))
);

CREATE TABLE "scrape_target" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"minimum_spacing_ms" integer NOT NULL,
	"requests_per_window" integer NOT NULL,
	"window_ms" integer NOT NULL,
	"timeout_ms" integer NOT NULL,
	"max_response_bytes" integer NOT NULL,
	"max_retries" integer NOT NULL,
	"next_request_at" timestamp,
	"blocked_until" timestamp,
	"window_started_at" timestamp,
	"window_request_count" integer DEFAULT 0 NOT NULL,
	"rate_limit_streak" integer DEFAULT 0 NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scrape_target_policy_check" CHECK ("scrape_target"."minimum_spacing_ms" >= 0
        AND "scrape_target"."requests_per_window" > 0
        AND "scrape_target"."window_ms" > 0
        AND "scrape_target"."timeout_ms" > 0
        AND "scrape_target"."max_response_bytes" > 0
        AND "scrape_target"."max_retries" >= 0),
	CONSTRAINT "scrape_target_counters_check" CHECK ("scrape_target"."window_request_count" >= 0 AND "scrape_target"."rate_limit_streak" >= 0),
	CONSTRAINT "scrape_target_lease_pair_check" CHECK (("scrape_target"."lease_token" IS NULL) = ("scrape_target"."lease_expires_at" IS NULL))
);

ALTER TABLE "external_site_run" ADD COLUMN "request_limit" integer DEFAULT 100 NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "request_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "rate_limit_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "emitted_item_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "cursor" jsonb;
ALTER TABLE "external_site_run" ADD COLUMN "next_attempt_at" timestamp;
ALTER TABLE "external_site_run" ADD COLUMN "execution_token" text;
ALTER TABLE "external_site_run" ADD COLUMN "execution_expires_at" timestamp;
ALTER TABLE "external_site_scrape_target" ADD CONSTRAINT "external_site_scrape_target_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "external_site_scrape_target" ADD CONSTRAINT "external_site_scrape_target_target_key_scrape_target_key_fk" FOREIGN KEY ("target_key") REFERENCES "public"."scrape_target"("key") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "scrape_origin" ADD CONSTRAINT "scrape_origin_target_key_scrape_target_key_fk" FOREIGN KEY ("target_key") REFERENCES "public"."scrape_target"("key") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "external_site_scrape_target_target_idx" ON "external_site_scrape_target" USING btree ("target_key","active");
CREATE INDEX "scrape_origin_target_idx" ON "scrape_origin" USING btree ("target_key","active");
CREATE INDEX "scrape_target_eligibility_idx" ON "scrape_target" USING btree ("enabled","blocked_until","next_request_at");
CREATE INDEX "external_site_run_dispatch_idx" ON "external_site_run" USING btree ("status","next_attempt_at","execution_expires_at");
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_request_budget_check" CHECK ("external_site_run"."request_limit" > 0
        AND "external_site_run"."request_count" >= 0
        AND "external_site_run"."request_count" <= "external_site_run"."request_limit"
        AND "external_site_run"."retry_count" >= 0
        AND "external_site_run"."rate_limit_count" >= 0
        AND "external_site_run"."emitted_item_count" >= 0);
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_execution_pair_check" CHECK (("external_site_run"."execution_token" IS NULL) = ("external_site_run"."execution_expires_at" IS NULL));