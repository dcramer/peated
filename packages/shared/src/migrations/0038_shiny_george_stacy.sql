CREATE TABLE IF NOT EXISTS "store_price" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"store_id" bigint NOT NULL,
	"name" text NOT NULL,
	"bottle_id" bigint,
	"price" integer NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DROP TABLE "bottle_price";
CREATE UNIQUE INDEX IF NOT EXISTS "store_price_unq_name" ON "store_price" ("store_id","name");
DO $$ BEGIN
 ALTER TABLE "store_price" ADD CONSTRAINT "store_price_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_price" ADD CONSTRAINT "store_price_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
