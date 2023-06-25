INSERT INTO "bottle_tag" ("bottle_id", "tag", "count")
  SELECT "tasting"."bottle_id", unnest("tasting"."tags") as "tag", COUNT(*) as "count"
  FROM "tasting"
  GROUP BY "bottle_id", "tag"
  ON CONFLICT ("bottle_id", "tag") DO UPDATE
    SET "count" = excluded.count;
