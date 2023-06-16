ALTER TABLE "bottle" ADD COLUMN "full_name" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_name_unq" ON "bottle" ("full_name");

UPDATE "bottle" SET "full_name" = (
    SELECT TRIM(TRAILING FROM CONCAT("entity"."name", ' ', "bottle"."name", ' ', "bottle"."series")) as "full_name"
    FROM "entity"
    WHERE "entity"."id" = "bottle"."brand_id" LIMIT 1
) ON CONFLICT ON CONSTRAINT "bottle_name_unq" DO NOTHING;

ALTER TABLE "bottle" ALTER COLUMN "full_name" SET NOT NULL;

DELETE FROM "change" WHERE "object_type" = "bottle" and "object_id" IN (
    SELECT "id" FROM "bottle" WHERE "full_name" IS NULL;
);
DELETE FROM "bottle" WHERE "full_name" IS NULL;
