ALTER TABLE "external_site_run" DROP CONSTRAINT "external_site_run_request_budget_check";
ALTER TABLE "review" ADD COLUMN "bottle_no_match_at" timestamp;
ALTER TABLE "external_site_run" ADD COLUMN "model_call_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_request_budget_check" CHECK ("external_site_run"."request_limit" > 0
        AND "external_site_run"."slice_request_count" >= 0
        AND "external_site_run"."slice_request_count" <= "external_site_run"."request_limit"
        AND "external_site_run"."request_count" >= 0
        AND ("external_site_run"."request_error_count" IS NULL OR (
          "external_site_run"."request_error_count" >= 0
          AND "external_site_run"."request_error_count" <= "external_site_run"."request_count"
        ))
        AND "external_site_run"."retry_count" >= 0
        AND "external_site_run"."rate_limit_count" >= 0
        AND "external_site_run"."emitted_item_count" >= 0
        AND "external_site_run"."new_item_count" >= 0
        AND "external_site_run"."existing_item_count" >= 0
        AND "external_site_run"."model_call_count" >= 0
        AND "external_site_run"."new_item_count" + "external_site_run"."existing_item_count" <= "external_site_run"."emitted_item_count");