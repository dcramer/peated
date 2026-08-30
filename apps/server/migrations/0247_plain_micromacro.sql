ALTER TABLE "external_review_source_policy" RENAME TO "external_review_publication";
ALTER TABLE "review" DROP CONSTRAINT "review_summary_provenance_check";
ALTER TABLE "external_review_publication" DROP CONSTRAINT "external_review_source_policy_disabled_check";
ALTER TABLE "external_review_publication" DROP CONSTRAINT "external_review_source_policy_summary_check";
ALTER TABLE "external_review_publication" DROP CONSTRAINT "external_review_source_policy_external_site_id_external_site_id_fk";

ALTER TABLE "external_review_publication" ADD COLUMN "approved_at" timestamp;
ALTER TABLE "external_review_publication" ADD CONSTRAINT "external_review_publication_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "review" DROP COLUMN "summary";
ALTER TABLE "review" DROP COLUMN "summary_content_hash";
ALTER TABLE "review" DROP COLUMN "summary_model";
ALTER TABLE "review" DROP COLUMN "summary_prompt_version";
ALTER TABLE "review" DROP COLUMN "summary_generated_at";
ALTER TABLE "external_review_publication" DROP COLUMN "publication_mode";
ALTER TABLE "external_review_publication" DROP COLUMN "allow_llm_processing";
ALTER TABLE "external_review_publication" DROP COLUMN "allow_score_display";
ALTER TABLE "external_review_publication" DROP COLUMN "allow_summary_display";
DROP TYPE "public"."external_review_publication_mode";