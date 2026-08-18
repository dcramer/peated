ALTER TABLE "external_site_run" DROP CONSTRAINT "external_site_run_request_budget_check";
ALTER TABLE "external_site_run" ADD COLUMN "slice_request_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD CONSTRAINT "external_site_run_request_budget_check" CHECK ("external_site_run"."request_limit" > 0
        AND "external_site_run"."slice_request_count" >= 0
        AND "external_site_run"."slice_request_count" <= "external_site_run"."request_limit"
        AND "external_site_run"."request_count" >= 0
        AND "external_site_run"."retry_count" >= 0
        AND "external_site_run"."rate_limit_count" >= 0
        AND "external_site_run"."emitted_item_count" >= 0);