ALTER TABLE "external_site" ADD COLUMN "next_run_at" timestamp;
ALTER TABLE "external_site" ADD COLUMN "run_every" integer DEFAULT 60;