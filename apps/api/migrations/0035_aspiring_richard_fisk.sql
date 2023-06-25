DO $$ BEGIN
 CREATE TYPE "price_scraper_type" AS ENUM('totalwines');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "bottle_price" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"store_id" bigint NOT NULL,
	"price" integer NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "store" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" price_scraper_type NOT NULL,
	"name" text NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_price_unq" ON "bottle_price" ("bottle_id","store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "store_type" ON "store" ("type");
DO $$ BEGIN
 ALTER TABLE "bottle_price" ADD CONSTRAINT "bottle_price_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bottle_price" ADD CONSTRAINT "bottle_price_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store" ADD CONSTRAINT "store_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
