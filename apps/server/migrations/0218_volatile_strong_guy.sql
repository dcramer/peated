DROP INDEX "store_price_unq_name";
ALTER TABLE "bottle_barcode" ADD COLUMN "volume" integer;
ALTER TABLE "store_price" ADD COLUMN "external_product_id" text;
ALTER TABLE "store_price" ADD COLUMN "barcode" varchar(14);
CREATE UNIQUE INDEX "store_price_site_external_product_unq" ON "store_price" USING btree ("external_site_id","external_product_id") WHERE "store_price"."external_product_id" IS NOT NULL;
CREATE INDEX "store_price_site_name_volume_idx" ON "store_price" USING btree ("external_site_id",LOWER("name"),"volume");
ALTER TABLE "store_price" ADD CONSTRAINT "store_price_barcode_check" CHECK ("store_price"."barcode" IS NULL OR ("store_price"."barcode" ~ '^[0-9]+$' AND char_length("store_price"."barcode") IN (8, 12, 13, 14)));