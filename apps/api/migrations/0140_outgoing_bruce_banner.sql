ALTER TYPE "badge_award_object_type" ADD VALUE 'country';
ALTER TYPE "badge_award_object_type" ADD VALUE 'region';
ALTER TABLE "badges" ADD COLUMN "tracker" "badge_award_object_type" DEFAULT 'bottle' NOT NULL;