CREATE TYPE "public"."external_site_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
CREATE TYPE "public"."external_site_run_trigger" AS ENUM('scheduled', 'manual');
CREATE TABLE "external_site_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"status" "external_site_run_status" DEFAULT 'queued' NOT NULL,
	"trigger" "external_site_run_trigger" NOT NULL,
	"requested_by_id" bigint,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"item_count" integer,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "external_site" ADD COLUMN "last_run_id" bigint;
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "external_site_run_active_unq" ON "external_site_run" USING btree ("external_site_id") WHERE "external_site_run"."status" IN ('queued', 'running');
CREATE INDEX "external_site_run_site_created_idx" ON "external_site_run" USING btree ("external_site_id","created_at");
CREATE INDEX "external_site_run_site_status_completed_idx" ON "external_site_run" USING btree ("external_site_id","status","completed_at");
ALTER TABLE "external_site" ADD CONSTRAINT "external_site_last_run_id_external_site_run_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."external_site_run"("id") ON DELETE set null ON UPDATE no action;