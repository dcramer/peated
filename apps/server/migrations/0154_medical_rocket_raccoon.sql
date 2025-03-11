ALTER TABLE "tasting_badge_award" DROP CONSTRAINT "tasting_badge_award_tasting_id_tasting_id_fk";
ALTER TABLE "tasting_badge_award" ADD CONSTRAINT "tasting_badge_award_tasting_id_tasting_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "public"."tasting"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "tasting_badge_award" DROP CONSTRAINT "tasting_badge_award_award_id_badge_award_id_fk";
ALTER TABLE "tasting_badge_award" ADD CONSTRAINT "tasting_badge_award_award_id_badge_award_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."badge_award"("id") ON DELETE cascade ON UPDATE no action;
