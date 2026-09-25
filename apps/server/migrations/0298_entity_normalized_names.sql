ALTER TABLE "entity" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g')) STORED;
ALTER TABLE "entity" ADD COLUMN "normalized_short_name" text GENERATED ALWAYS AS (regexp_replace(lower(coalesce(short_name, '')), '[^a-z0-9]+', '', 'g')) STORED;
ALTER TABLE "entity_reference" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g')) STORED;
CREATE INDEX "entity_normalized_name_idx" ON "entity" USING btree ("normalized_name");
CREATE INDEX "entity_normalized_short_name_idx" ON "entity" USING btree ("normalized_short_name");
CREATE INDEX "entity_reference_normalized_name_idx" ON "entity_reference" USING btree ("normalized_name");