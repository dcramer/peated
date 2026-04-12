ALTER TABLE "legacy_release_repair_review" DROP CONSTRAINT "legacy_release_repair_review_reviewed_parent_bottle_id_bottle_id_fk";

ALTER TABLE "legacy_release_repair_review" ADD CONSTRAINT "legacy_release_repair_review_reviewed_parent_bottle_id_bottle_id_fk" FOREIGN KEY ("reviewed_parent_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;