ALTER TABLE "bottle" ADD COLUMN "full_name" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_name_unq" ON "bottle" ("full_name");

UPDATE "bottle"
SET "full_name" = e."full_name"
FROM (
    SELECT TRIM(TRAILING FROM CONCAT("entity"."name", ' ', "bottle"."name", ' ', "bottle"."series")) as "full_name", "bottle"."id" as "bottle_id"
    FROM "bottle"
    JOIN "entity" ON "bottle"."brand_id" = "entity"."id"
) AS e
WHERE e."bottle_id" = "bottle"."id"
  AND NOT EXISTS (
    SELECT FROM "bottle" b2
    WHERE b2."full_name" != e."full_name"
  );

DELETE FROM "change" WHERE "object_type" = "bottle" and "object_id" IN (
    SELECT "id" FROM "bottle" WHERE "full_name" IS NULL;
);
DELETE FROM "bottle" WHERE "full_name" IS NULL;

ALTER TABLE "bottle" ALTER COLUMN "full_name" SET NOT NULL;
