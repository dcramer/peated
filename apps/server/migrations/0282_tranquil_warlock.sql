ALTER TYPE "public"."object_type" ADD VALUE 'member_review';
ALTER TYPE "public"."object_type" ADD VALUE 'external_review';
ALTER TABLE "review" ADD COLUMN "removed_at" timestamp;
ALTER TABLE "review" ADD COLUMN "removed_by_actor_id" bigint;
ALTER TABLE "review" ADD COLUMN "removal_reason" text;
ALTER TABLE "member_review" ADD COLUMN "removed_at" timestamp;
ALTER TABLE "member_review" ADD COLUMN "removed_by_actor_id" bigint;
ALTER TABLE "member_review" ADD COLUMN "removal_reason" text;
ALTER TABLE "tasting" ADD COLUMN "removed_at" timestamp;
ALTER TABLE "tasting" ADD COLUMN "removed_by_actor_id" bigint;
ALTER TABLE "tasting" ADD COLUMN "removal_reason" text;
ALTER TABLE "review" ADD CONSTRAINT "review_removed_by_actor_id_actor_id_fk" FOREIGN KEY ("removed_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "member_review" ADD CONSTRAINT "member_review_removed_by_actor_id_actor_id_fk" FOREIGN KEY ("removed_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_removed_by_actor_id_actor_id_fk" FOREIGN KEY ("removed_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "change_object_created_idx" ON "change" USING btree ("object_type","object_id","created_at");
CREATE INDEX "review_removed_updated_idx" ON "review" USING btree ("removed_at","updated_at","id");
CREATE INDEX "member_review_removed_updated_idx" ON "member_review" USING btree ("removed_at","updated_at","id");
CREATE INDEX "tasting_removed_created_idx" ON "tasting" USING btree ("removed_at","created_at","id");
ALTER TABLE "review" ADD CONSTRAINT "review_removal_state_check" CHECK ((
        "review"."removed_at" IS NULL
        AND "review"."removed_by_actor_id" IS NULL
        AND "review"."removal_reason" IS NULL
      ) OR (
        "review"."removed_at" IS NOT NULL
        AND "review"."removed_by_actor_id" IS NOT NULL
        AND NULLIF(BTRIM("review"."removal_reason"), '') IS NOT NULL
      ));
ALTER TABLE "member_review" ADD CONSTRAINT "member_review_removal_state_check" CHECK ((
        "member_review"."removed_at" IS NULL
        AND "member_review"."removed_by_actor_id" IS NULL
        AND "member_review"."removal_reason" IS NULL
      ) OR (
        "member_review"."removed_at" IS NOT NULL
        AND "member_review"."removed_by_actor_id" IS NOT NULL
        AND NULLIF(BTRIM("member_review"."removal_reason"), '') IS NOT NULL
      ));
ALTER TABLE "tasting" ADD CONSTRAINT "tasting_removal_state_check" CHECK ((
        "tasting"."removed_at" IS NULL
        AND "tasting"."removed_by_actor_id" IS NULL
        AND "tasting"."removal_reason" IS NULL
      ) OR (
        "tasting"."removed_at" IS NOT NULL
        AND "tasting"."removed_by_actor_id" IS NOT NULL
        AND NULLIF(BTRIM("tasting"."removal_reason"), '') IS NOT NULL
      ));