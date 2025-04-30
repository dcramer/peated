ALTER TABLE "user" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;

UPDATE "user" SET verified = true WHERE EXISTS (SELECT FROM "identity" WHERE "user_id" = "user"."id");
