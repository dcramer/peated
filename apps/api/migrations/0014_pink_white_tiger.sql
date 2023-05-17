ALTER TABLE "user" ADD COLUMN "username" text;
--> statement-breakpoint
UPDATE "user" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unq" ON "user" ("username");
