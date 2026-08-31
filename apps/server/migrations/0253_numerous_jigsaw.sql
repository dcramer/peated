ALTER TABLE "bottle" DROP CONSTRAINT "bottle_release_date_year_check";
DROP INDEX "bottle_release_sort_idx";
ALTER TABLE "bottle" ADD COLUMN "release_month" smallint;
ALTER TABLE "bottle" ADD COLUMN "release_day" smallint;
CREATE INDEX "bottle_release_sort_idx" ON "bottle" USING btree ("release_year" DESC NULLS LAST,"release_month" DESC NULLS LAST,"release_day" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id");
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_release_month_check" CHECK ("bottle"."release_month" IS NULL OR ("bottle"."release_year" IS NOT NULL AND "bottle"."release_month" BETWEEN 1 AND 12));
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_release_day_check" CHECK (CASE
        WHEN "bottle"."release_day" IS NULL THEN TRUE
        WHEN "bottle"."release_year" IS NULL OR "bottle"."release_month" IS NULL OR "bottle"."release_month" NOT BETWEEN 1 AND 12 THEN FALSE
        ELSE "bottle"."release_day" BETWEEN 1 AND EXTRACT(DAY FROM (MAKE_DATE("bottle"."release_year", "bottle"."release_month", 1) + INTERVAL '1 month - 1 day'))
      END);