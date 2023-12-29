INSERT INTO "bottle_alias" ("bottle_id", "name")
  SELECT "bottle"."id" as "bottle_id", "bottle"."full_name" as "name"
  FROM "bottle"
  ON CONFLICT ("bottle_id", "name") DO NOTHING;
