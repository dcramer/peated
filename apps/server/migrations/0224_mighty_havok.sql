ALTER TABLE "external_review_source_policy" DROP CONSTRAINT "external_review_source_policy_approval_check";
ALTER TABLE "external_review_source_policy" DROP CONSTRAINT "external_review_source_policy_approved_by_actor_id_actor_id_fk";

ALTER TABLE "external_review_source_policy" DROP COLUMN "policy_evidence_url";
ALTER TABLE "external_review_source_policy" DROP COLUMN "approval_reference";
ALTER TABLE "external_review_source_policy" DROP COLUMN "reviewed_at";
ALTER TABLE "external_review_source_policy" DROP COLUMN "approved_by_actor_id";