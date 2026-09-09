CREATE TYPE "public"."entity_status" AS ENUM('active', 'mothballed', 'closed', 'discontinued');
ALTER TABLE "entity" ADD COLUMN "status" "entity_status";
CREATE INDEX "entity_status_idx" ON "entity" USING btree ("status");
ALTER TABLE "entity" ADD CONSTRAINT "entity_status_kind_check" CHECK ("entity"."status" IS NULL
        OR "entity"."status" = 'active'
        OR ("entity"."kind" = 'distillery' AND "entity"."status" IN ('mothballed', 'closed'))
        OR ("entity"."kind" = 'brand' AND "entity"."status" = 'discontinued')
        OR ("entity"."kind" IN ('bottler', 'company') AND "entity"."status" = 'closed'));