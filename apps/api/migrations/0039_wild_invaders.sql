ALTER TABLE "bottle" ADD COLUMN "full_name" varchar(255);

UPDATE "bottle" SET "full_name" = (
    SELECT TRIM(TRAILING FROM CONCAT("entity"."name", ' ', "bottle"."name", ' ', "bottle"."series")) as "full_name"
    FROM "entity"
    WHERE "entity"."id" = "bottle"."brand_id" LIMIT 1
);

ALTER TABLE "bottle" ALTER COLUMN "full_name" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_name_unq" ON "bottle" ("full_name");
