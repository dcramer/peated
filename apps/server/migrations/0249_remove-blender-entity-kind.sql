ALTER TABLE "public"."entity" ALTER COLUMN "kind" SET DATA TYPE text;
DROP TYPE "public"."entity_kind";
CREATE TYPE "public"."entity_kind" AS ENUM('brand', 'distillery', 'bottler', 'company');
ALTER TABLE "public"."entity" ALTER COLUMN "kind" SET DATA TYPE "public"."entity_kind" USING "kind"::"public"."entity_kind";