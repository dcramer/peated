ALTER TABLE "bottle_barcode" ADD CONSTRAINT "bottle_barcode_volume_check" CHECK ("bottle_barcode"."volume" IS NULL OR "bottle_barcode"."volume" > 0);
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_abv_check" CHECK ("bottle"."abv" IS NULL OR ("bottle"."abv" >= 0 AND "bottle"."abv" <= 100));
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_vintage_year_check" CHECK ("bottle"."vintage_year" IS NULL OR "bottle"."vintage_year" >= 1800);
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_release_year_check" CHECK ("bottle"."release_year" IS NULL OR "bottle"."release_year" >= 1800);
ALTER TABLE "store_price_history" ADD CONSTRAINT "store_price_history_price_check" CHECK ("store_price_history"."price" > 0);
ALTER TABLE "store_price_history" ADD CONSTRAINT "store_price_history_volume_check" CHECK ("store_price_history"."volume" > 0);
ALTER TABLE "store_price" ADD CONSTRAINT "store_price_price_check" CHECK ("store_price"."price" > 0);
ALTER TABLE "store_price" ADD CONSTRAINT "store_price_volume_check" CHECK ("store_price"."volume" > 0);