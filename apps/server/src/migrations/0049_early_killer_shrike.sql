ALTER TABLE "store_price_history" ADD COLUMN "volume" integer DEFAULT 750 NOT NULL;
ALTER TABLE "store_price" ADD COLUMN "volume" integer DEFAULT 750 NOT NULL;

DROP INDEX IF EXISTS "store_price_history_unq";
DROP INDEX IF EXISTS "store_price_unq_name";

CREATE UNIQUE INDEX IF NOT EXISTS "store_price_history_unq" ON "store_price_history" ("price_id","volume","date");
CREATE UNIQUE INDEX IF NOT EXISTS "store_price_unq_name" ON "store_price" ("store_id","name","volume");
