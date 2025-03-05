ALTER TABLE "entity" ADD COLUMN "parent_id" bigint;
ALTER TABLE "entity" ADD CONSTRAINT "entity_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entity"("id") ON DELETE SET NULL ON UPDATE SET NULL;
