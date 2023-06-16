ALTER TABLE "bottle" ADD COLUMN "full_name" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_name_unq" ON "bottle" ("full_name");

UPDATE "bottle"
SET "full_name" = f."full_name"
FROM (
    -- lol postgres
    SELECT DISTINCT ON (TRIM(TRAILING FROM CONCAT(e."name", ' ', b."name", ' ', b."series"))) TRIM(TRAILING FROM CONCAT(e."name", ' ', b."name", ' ', b."series")) as "full_name", b."id" as "bottle_id"
    FROM "bottle" as b
    JOIN "entity" as e ON b."brand_id" = e."id"
) AS f
WHERE f."bottle_id" = "bottle"."id"
  AND NOT EXISTS (
    SELECT FROM "bottle" b2
    WHERE b2."full_name" = f."full_name"
      AND b2."id" != "bottle"."id"
  );

DELETE FROM "change" WHERE "object_type" = 'bottle' and "object_id" IN (
  SELECT "id" FROM "bottle" WHERE "full_name" IS NULL
);

DELETE FROM "bottle" WHERE "full_name" IS NULL;

ALTER TABLE "bottle" ALTER COLUMN "full_name" SET NOT NULL;
