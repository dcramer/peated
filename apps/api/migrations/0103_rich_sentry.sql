DO $$ BEGIN
 CREATE TYPE "currency" AS ENUM('usd', 'gbp', 'eur');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "store_price_history" ADD COLUMN "currency" "currency" DEFAULT 'usd' NOT NULL;
ALTER TABLE "store_price" ADD COLUMN "currency" "currency" DEFAULT 'usd' NOT NULL;
