ALTER TABLE "badges" RENAME COLUMN "config" TO "checks";
ALTER TABLE "badges" ALTER COLUMN "checks" SET DEFAULT '[]'::jsonb;
ALTER TABLE "badges" DROP COLUMN IF EXISTS "type";