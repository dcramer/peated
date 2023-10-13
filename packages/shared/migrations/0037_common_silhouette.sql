ALTER TABLE "store" DROP CONSTRAINT "store_created_by_id_user_id_fk";

ALTER TABLE "store" DROP COLUMN IF EXISTS "created_by_id";