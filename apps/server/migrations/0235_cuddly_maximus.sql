ALTER TABLE "bottle" ADD COLUMN "no_age_statement" boolean;
ALTER TABLE "bottle" ADD COLUMN "natural_color" boolean;
ALTER TABLE "bottle" ADD COLUMN "non_chill_filtered" boolean;
ALTER TABLE "bottle" ADD COLUMN "malt_phenol_ppm" double precision;
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_age_statement_check" CHECK ("bottle"."stated_age" IS NULL OR "bottle"."no_age_statement" IS NOT TRUE);
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_malt_phenol_ppm_check" CHECK ("bottle"."malt_phenol_ppm" IS NULL OR "bottle"."malt_phenol_ppm" >= 0);