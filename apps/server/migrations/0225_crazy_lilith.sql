ALTER TABLE "external_review_source_policy" DROP CONSTRAINT "external_review_source_policy_disabled_check";
ALTER TABLE "external_review_source_policy" DROP COLUMN "allow_fetching";
ALTER TABLE "external_review_source_policy" ADD CONSTRAINT "external_review_source_policy_disabled_check" CHECK ("external_review_source_policy"."publication_mode" <> 'disabled' OR (
        NOT "external_review_source_policy"."allow_llm_processing"
        AND NOT "external_review_source_policy"."allow_score_display"
        AND NOT "external_review_source_policy"."allow_summary_display"
      ));