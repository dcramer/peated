CREATE TYPE "public"."actor_type" AS ENUM('system', 'user');
CREATE TABLE "actor" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" "actor_type" NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"user_id" bigint,
	"picture_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "change" ALTER COLUMN "created_by_id" DROP NOT NULL;
ALTER TABLE "bottle_alias" ADD COLUMN "assigned_by_actor_id" bigint;
ALTER TABLE "bottle_release" ADD COLUMN "created_by_actor_id" bigint;
ALTER TABLE "bottle_series" ADD COLUMN "created_by_actor_id" bigint;
ALTER TABLE "bottle" ADD COLUMN "created_by_actor_id" bigint;
ALTER TABLE "change" ADD COLUMN "actor_id" bigint;
ALTER TABLE "entity" ADD COLUMN "created_by_actor_id" bigint;
ALTER TABLE "incoming_bottle_decision_log" ADD COLUMN "actor_id" bigint;
ALTER TABLE "actor" ADD CONSTRAINT "actor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "actor_type_key_unq" ON "actor" USING btree ("type","key");
CREATE INDEX "actor_user_idx" ON "actor" USING btree ("user_id");
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_assigned_by_actor_id_actor_id_fk" FOREIGN KEY ("assigned_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle_release" ADD CONSTRAINT "bottle_release_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle_series" ADD CONSTRAINT "bottle_series_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "change" ADD CONSTRAINT "change_actor_id_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "entity" ADD CONSTRAINT "entity_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_actor_id_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_alias_assigned_by_actor_idx" ON "bottle_alias" USING btree ("assigned_by_actor_id");
CREATE INDEX "bottle_release_created_by_actor_idx" ON "bottle_release" USING btree ("created_by_actor_id");
CREATE INDEX "bottle_series_created_by_actor_idx" ON "bottle_series" USING btree ("created_by_actor_id");
CREATE INDEX "bottle_created_by_actor_idx" ON "bottle" USING btree ("created_by_actor_id");
CREATE INDEX "change_actor_idx" ON "change" USING btree ("actor_id");
CREATE INDEX "entity_created_by_actor_idx" ON "entity" USING btree ("created_by_actor_id");
CREATE INDEX "incoming_bottle_decision_actor_ref_idx" ON "incoming_bottle_decision_log" USING btree ("actor_id");