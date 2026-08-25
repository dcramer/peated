CREATE TYPE "public"."entity_kind" AS ENUM('brand', 'distillery', 'bottler', 'blender', 'company');
ALTER TABLE "entity" RENAME COLUMN "parent_id" TO "owner_id";
ALTER TABLE "entity" DROP CONSTRAINT "entity_parent_fk";

ALTER TABLE "entity" ADD COLUMN "kind" "entity_kind";
ALTER TABLE "entity" ADD CONSTRAINT "entity_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."entity"("id") ON DELETE set null ON UPDATE set null;
CREATE INDEX "entity_kind_idx" ON "entity" USING btree ("kind");
CREATE INDEX "entity_owner_idx" ON "entity" USING btree ("owner_id");