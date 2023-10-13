ALTER TABLE "toasts" ADD COLUMN "id" bigserial NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "toast_unq" ON "toasts" ("tasting_id","created_by_id");
ALTER TABLE "toasts" DROP CONSTRAINT "toasts_tasting_id_created_by_id";