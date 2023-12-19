DO $$ BEGIN
 CREATE TYPE "notification_type" AS ENUM('comment', 'toast', 'friend_request');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "notification_type_temp" AS ENUM('comment', 'toast', 'friend_request', 'follow');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;


ALTER TABLE "notifications" RENAME COLUMN "object_type" TO "type";
DROP INDEX IF EXISTS "notifications_unq";
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE notification_type_temp USING type::text::notification_type_temp;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_unq" ON "notifications" ("user_id","object_id","type","created_at");

UPDATE "notifications" set "type" = 'friend_request' WHERE "type" = 'follow';
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE notification_type USING type::text::notification_type;
DROP TYPE "notification_type_temp";
