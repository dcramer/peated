CREATE TYPE "public"."collection_bottle_status" AS ENUM('sealed', 'open', 'empty');
ALTER TABLE "collection_bottle" ADD COLUMN "status" "collection_bottle_status";