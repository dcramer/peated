CREATE INDEX "entity_name_lower_pattern_idx" ON "entity" USING btree (LOWER("name") text_pattern_ops);
CREATE INDEX "entity_short_name_lower_pattern_idx" ON "entity" USING btree (LOWER("short_name") text_pattern_ops);
CREATE INDEX "entity_reference_name_lower_pattern_idx" ON "entity_reference" USING btree (LOWER("name") text_pattern_ops);