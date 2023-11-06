ALTER TABLE "change" ADD COLUMN "display_name" text;

UPDATE "change" SET "display_name" = (
  SELECT "name" FROM "entity" WHERE "entity"."id" = "change"."object_id"
) WHERE "change"."object_type" = 'entity';

UPDATE "change" SET "display_name" = (
  SELECT "entity"."name" || ' ' || "bottle"."name" FROM "bottle" JOIN "entity" ON "bottle"."brand_id" = "entity"."id" WHERE "bottle"."id" = "change"."object_id"
) WHERE "change"."object_type" = 'bottle';
