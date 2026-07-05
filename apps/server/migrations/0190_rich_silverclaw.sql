ALTER TABLE "bottle_alias" DROP CONSTRAINT "bottle_alias_assigned_by_id_user_id_fk";

ALTER TABLE "bottle_alias" DROP CONSTRAINT "bottle_alias_assigned_by_actor_id_actor_id_fk";

ALTER TABLE "bottle_release" DROP CONSTRAINT "bottle_release_created_by_id_user_id_fk";

ALTER TABLE "bottle_release" DROP CONSTRAINT "bottle_release_created_by_actor_id_actor_id_fk";

ALTER TABLE "bottle_series" DROP CONSTRAINT "bottle_series_created_by_id_user_id_fk";

ALTER TABLE "bottle_series" DROP CONSTRAINT "bottle_series_created_by_actor_id_actor_id_fk";

ALTER TABLE "bottle" DROP CONSTRAINT "bottle_created_by_id_user_id_fk";

ALTER TABLE "bottle" DROP CONSTRAINT "bottle_created_by_actor_id_actor_id_fk";

ALTER TABLE "change" DROP CONSTRAINT "change_created_by_id_user_id_fk";

ALTER TABLE "entity" DROP CONSTRAINT "entity_created_by_id_user_id_fk";

ALTER TABLE "entity" DROP CONSTRAINT "entity_created_by_actor_id_actor_id_fk";

ALTER TABLE "incoming_bottle_decision_log" DROP CONSTRAINT "incoming_bottle_decision_log_actor_user_id_user_id_fk";

DROP INDEX "bottle_release_created_by_idx";
DROP INDEX "bottle_series_created_by_idx";
DROP INDEX "bottle_created_by_idx";
DROP INDEX "change_created_by_idx";
DROP INDEX "entity_created_by_idx";
DROP INDEX "incoming_bottle_decision_actor_idx";
DROP INDEX "incoming_bottle_decision_actor_user_idx";
ALTER TABLE "bottle_alias" ALTER COLUMN "assigned_by_actor_id" SET NOT NULL;
ALTER TABLE "bottle_release" ALTER COLUMN "created_by_actor_id" SET NOT NULL;
ALTER TABLE "bottle_series" ALTER COLUMN "created_by_actor_id" SET NOT NULL;
ALTER TABLE "bottle" ALTER COLUMN "created_by_actor_id" SET NOT NULL;
ALTER TABLE "entity" ALTER COLUMN "created_by_actor_id" SET NOT NULL;
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_assigned_by_actor_id_actor_id_fk" FOREIGN KEY ("assigned_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release" ADD CONSTRAINT "bottle_release_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_series" ADD CONSTRAINT "bottle_series_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "entity" ADD CONSTRAINT "entity_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_alias" DROP COLUMN "assigned_by_id";
ALTER TABLE "bottle_release" DROP COLUMN "created_by_id";
ALTER TABLE "bottle_series" DROP COLUMN "created_by_id";
ALTER TABLE "bottle" DROP COLUMN "created_by_id";
ALTER TABLE "change" DROP COLUMN "created_by_id";
ALTER TABLE "entity" DROP COLUMN "created_by_id";
ALTER TABLE "incoming_bottle_decision_log" DROP COLUMN "actor_type";
ALTER TABLE "incoming_bottle_decision_log" DROP COLUMN "actor_user_id";
DROP TYPE "public"."incoming_bottle_decision_actor_type";