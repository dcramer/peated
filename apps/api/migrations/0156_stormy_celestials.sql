ALTER TYPE "public"."object_type" ADD VALUE 'bottle_release' BEFORE 'comment';
ALTER TABLE "bottle" ADD COLUMN "num_releases" bigint DEFAULT 0 NOT NULL;