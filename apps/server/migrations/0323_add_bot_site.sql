CREATE TABLE "bot_site" (
	"origin" text PRIMARY KEY NOT NULL,
	"robots_exception_reason" text,
	"robots_exception_by_id" bigint,
	"robots_exception_at" timestamp,
	"blocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_site_origin_check" CHECK ("bot_site"."origin" ~ '^https?://[^/]+$'),
	CONSTRAINT "bot_site_robots_exception_check" CHECK (("bot_site"."robots_exception_reason" IS NULL
          AND "bot_site"."robots_exception_by_id" IS NULL
          AND "bot_site"."robots_exception_at" IS NULL)
        OR ("bot_site"."robots_exception_reason" IS NOT NULL
          AND "bot_site"."robots_exception_by_id" IS NOT NULL
          AND "bot_site"."robots_exception_at" IS NOT NULL))
);

ALTER TABLE "bot_site" ADD CONSTRAINT "bot_site_robots_exception_by_id_user_id_fk" FOREIGN KEY ("robots_exception_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;