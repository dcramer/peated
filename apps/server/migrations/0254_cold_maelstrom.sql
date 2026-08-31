ALTER TYPE "public"."bottle_alias_assignment_source" RENAME TO "bottle_reference_assignment_source";
ALTER TABLE "bottle_alias" RENAME TO "bottle_reference";
ALTER TABLE "store_price_match_proposal" RENAME COLUMN "alias_scope" TO "reference_scope";
ALTER TABLE "bottle_reference" DROP CONSTRAINT "bottle_alias_bottle_id_bottle_id_fk";

ALTER TABLE "bottle_reference" DROP CONSTRAINT "bottle_alias_assigned_by_actor_id_actor_id_fk";

DROP INDEX "bottle_alias_name_idx";
DROP INDEX "bottle_alias_bottle_idx";
DROP INDEX "bottle_alias_release_idx";
DROP INDEX "bottle_alias_assigned_by_actor_idx";
ALTER TABLE "bottle_reference" ADD COLUMN "id" bigserial PRIMARY KEY NOT NULL;
ALTER TABLE "bottle_reference" ADD COLUMN "reviewed_by_actor_id" bigint;
ALTER TABLE "bottle_reference" ADD COLUMN "reviewed_at" timestamp;
ALTER TABLE "bottle_reference" ADD CONSTRAINT "bottle_reference_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_reference" ADD CONSTRAINT "bottle_reference_assigned_by_actor_id_actor_id_fk" FOREIGN KEY ("assigned_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_reference" ADD CONSTRAINT "bottle_reference_reviewed_by_actor_id_actor_id_fk" FOREIGN KEY ("reviewed_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "bottle_reference_name_idx" ON "bottle_reference" USING btree (LOWER("name"));
CREATE INDEX "bottle_reference_bottle_idx" ON "bottle_reference" USING btree ("bottle_id");
CREATE INDEX "bottle_reference_release_idx" ON "bottle_reference" USING btree ("release_id");
CREATE INDEX "bottle_reference_assigned_by_actor_idx" ON "bottle_reference" USING btree ("assigned_by_actor_id");
CREATE INDEX "bottle_reference_reviewed_by_actor_idx" ON "bottle_reference" USING btree ("reviewed_by_actor_id");