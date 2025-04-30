ALTER TABLE "store_price" RENAME COLUMN "store_id" TO "external_site_id";
ALTER TABLE "store_price" DROP CONSTRAINT "store_price_store_id_store_id_fk";

DROP INDEX IF EXISTS "store_price_unq_name";
CREATE UNIQUE INDEX IF NOT EXISTS "store_price_unq_name" ON "store_price" ("external_site_id","name","volume");
DO $$ BEGIN
 ALTER TABLE "store_price" ADD CONSTRAINT "store_price_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "external_site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
