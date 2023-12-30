INSERT INTO "external_site" ("id", "type", "name", "last_run_at", "created_at")
  SELECT "id", store.type::text::external_site_type as "type", "name", "last_run_at", "created_at"
  FROM "store"
  ON CONFLICT ("type") DO NOTHING;
