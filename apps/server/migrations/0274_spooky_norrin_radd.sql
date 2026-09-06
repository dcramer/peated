CREATE TYPE "public"."scrape_record_type" AS ENUM('review', 'price', 'catalog', 'bottle');
ALTER TABLE "external_site_run" DROP CONSTRAINT "external_site_run_request_budget_check";
ALTER TABLE "external_site_run" ADD COLUMN "purpose" "scrape_source_run_purpose" DEFAULT 'collect' NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "request_error_count" integer;
ALTER TABLE "external_site_run" ADD COLUMN "record_type" "scrape_record_type";
ALTER TABLE "external_site_run" ADD COLUMN "new_item_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "external_site_run" ADD COLUMN "existing_item_count" integer DEFAULT 0 NOT NULL;
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
        AND "external_site_run"."new_item_count" + "external_site_run"."existing_item_count" <= "external_site_run"."emitted_item_count");