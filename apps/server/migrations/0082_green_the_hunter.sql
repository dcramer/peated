CREATE INDEX IF NOT EXISTS "bottle_alias_bottle_idx" ON "bottle_alias" ("bottle_id");
CREATE INDEX IF NOT EXISTS "bottle_brand_idx" ON "bottle" ("brand_id");
CREATE INDEX IF NOT EXISTS "bottle_bottler_idx" ON "bottle" ("bottler_id");
CREATE INDEX IF NOT EXISTS "bottle_created_by_idx" ON "bottle" ("created_by_id");
CREATE INDEX IF NOT EXISTS "entity_created_by_idx" ON "entity" ("created_by_id");
CREATE INDEX IF NOT EXISTS "tasting_bottle_idx" ON "tasting" ("bottle_id");
CREATE INDEX IF NOT EXISTS "tasting_flight_idx" ON "tasting" ("flight_id");
CREATE INDEX IF NOT EXISTS "tasting_created_by_idx" ON "tasting" ("created_by_id");