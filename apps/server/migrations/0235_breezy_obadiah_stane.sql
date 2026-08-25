ALTER TABLE "bottle" ADD COLUMN "no_age_statement" boolean;
ALTER TABLE "bottle" ADD COLUMN "natural_color" boolean;
ALTER TABLE "bottle" ADD COLUMN "non_chill_filtered" boolean;
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_age_statement_check" CHECK ("bottle"."stated_age" IS NULL OR "bottle"."no_age_statement" IS NOT TRUE);