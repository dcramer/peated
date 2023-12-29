DO $$ BEGIN
 CREATE TYPE "external_site_type" AS ENUM('astorwines', 'healthyspirits', 'totalwines', 'woodencork', 'whiskyadvocate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "external_site" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" "external_site_type" NOT NULL,
	"name" text NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "review" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"name" text NOT NULL,
	"bottle_id" bigint,
	"rating" integer NOT NULL,
	"issue" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_url_unique" UNIQUE("url")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_site_type" ON "external_site" ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "store_price_unq_name" ON "review" ("external_site_id","name","issue");
DO $$ BEGIN
 ALTER TABLE "review" ADD CONSTRAINT "review_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "external_site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "review" ADD CONSTRAINT "review_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "store_price" ADD CONSTRAINT "store_price_url_unique" UNIQUE("url");