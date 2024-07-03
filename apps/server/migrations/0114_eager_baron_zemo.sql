ALTER TABLE "bottle" ALTER COLUMN "release_date" SET DATA TYPE date;
ALTER TABLE "bottle" ADD COLUMN "uniq_hash" varchar(32) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_uniq_hash" ON "bottle" ("uniq_hash");

UPDATE "bottle" SET "uniq_hash" = md5("bottle"."full_name");

ALTER TABLE "bottle" ALTER COLUMN "uniq_hash" SET NOT NULL;
