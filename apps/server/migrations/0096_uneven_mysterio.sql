DO $$ BEGIN
 CREATE TYPE "content_source" AS ENUM('generated', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "entity" ADD COLUMN "description_src" "content_source";