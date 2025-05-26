UPDATE "bottle" SET "stated_age" = NULL WHERE "stated_age" < 0;
UPDATE "bottle_release" SET "stated_age" = NULL WHERE "stated_age" < 0;
UPDATE "bottle" SET "stated_age" = NULL WHERE "stated_age" >= 100;
UPDATE "bottle_release" SET "stated_age" = NULL WHERE "stated_age" >= 100;

ALTER TABLE "bottle_release" ADD CONSTRAINT "bottle_release_stated_age_check" CHECK ("bottle_release"."stated_age" IS NULL OR ("bottle_release"."stated_age" >= 0 AND "bottle_release"."stated_age" <= 100));
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_stated_age_check" CHECK ("bottle"."stated_age" IS NULL OR ("bottle"."stated_age" >= 0 AND "bottle"."stated_age" <= 100));
