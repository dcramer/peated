ALTER TABLE "entity_alias" RENAME TO "entity_reference";
ALTER TABLE "entity_reference" DROP CONSTRAINT "entity_alias_entity_id_entity_id_fk";

DROP INDEX "entity_alias_entity_idx";
DROP INDEX "entity_alias_name_idx";
ALTER TABLE "entity_reference" ADD CONSTRAINT "entity_reference_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "entity_reference_entity_idx" ON "entity_reference" USING btree ("entity_id");
CREATE UNIQUE INDEX "entity_reference_name_idx" ON "entity_reference" USING btree (LOWER("name"));