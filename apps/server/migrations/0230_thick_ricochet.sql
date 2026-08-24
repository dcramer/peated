UPDATE "store_price" SET "hidden" = false WHERE "hidden" IS NULL;
--> statement-breakpoint
ALTER TABLE "store_price" ALTER COLUMN "hidden" SET NOT NULL;
