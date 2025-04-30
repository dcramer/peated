
INSERT INTO "entity_alias" ("entity_id", "name")
  SELECT "entity"."id" as "entity_id", SUBSTRING("entity"."name", 5) as "name"
  FROM "entity"
  WHERE "name" ILIKE 'The %'
  ON CONFLICT ("name") DO NOTHING;
