ALTER TABLE "tasting" ADD COLUMN "idempotency_key" varchar(128);
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_idempotency_key" UNIQUE("created_by_id","idempotency_key");