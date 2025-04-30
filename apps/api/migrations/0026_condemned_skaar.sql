DO $$ BEGIN
 CREATE TYPE "type" AS ENUM('add', 'update', 'delete');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "change" ALTER COLUMN "data" SET DATA TYPE jsonb USING "data"::jsonb;
ALTER TABLE "change" ALTER COLUMN "data" SET DEFAULT '{}'::jsonb;
ALTER TABLE "change" ADD COLUMN "type" "type" DEFAULT 'add' NOT NULL;
