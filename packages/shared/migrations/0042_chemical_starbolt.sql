CREATE TABLE IF NOT EXISTS "store_price_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"price_id" bigint NOT NULL,
	"price" integer NOT NULL,
	"date" date DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_price_history_unq" ON "store_price_history" ("price_id","date");
DO $$ BEGIN
 ALTER TABLE "store_price_history" ADD CONSTRAINT "store_price_history_price_id_store_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "store_price"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
