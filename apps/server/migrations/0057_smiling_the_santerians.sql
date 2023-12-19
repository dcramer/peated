ALTER TABLE "flight" ADD COLUMN "public_id" varchar(12) NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "flight_public_id" ON "flight" ("public_id");
