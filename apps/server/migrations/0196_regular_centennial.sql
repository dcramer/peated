ALTER TABLE "bottle_alias" DROP CONSTRAINT "bottle_alias_release_id_bottle_release_id_fk";

ALTER TABLE "bottle_observation" DROP CONSTRAINT "bottle_observation_release_id_bottle_release_id_fk";

ALTER TABLE "bottle_release_promotion" DROP CONSTRAINT "bottle_release_promotion_release_id_bottle_release_id_fk";

ALTER TABLE "bottle_release_promotion" DROP CONSTRAINT "bottle_release_promotion_promoted_bottle_id_bottle_id_fk";

ALTER TABLE "collection_bottle" DROP CONSTRAINT "collection_bottle_release_id_bottle_release_id_fk";

ALTER TABLE "flight_bottle" DROP CONSTRAINT "flight_bottle_release_id_bottle_release_id_fk";

ALTER TABLE "incoming_bottle_decision_log" DROP CONSTRAINT "incoming_bottle_decision_log_release_id_bottle_release_id_fk";

ALTER TABLE "legacy_release_repair_review" DROP CONSTRAINT "legacy_release_repair_review_legacy_bottle_id_bottle_id_fk";

ALTER TABLE "legacy_release_repair_review" DROP CONSTRAINT "legacy_release_repair_review_reviewed_parent_bottle_id_bottle_id_fk";

ALTER TABLE "review" DROP CONSTRAINT "review_release_id_bottle_release_id_fk";

ALTER TABLE "store_price_match_attempt" DROP CONSTRAINT "store_price_match_attempt_current_release_id_bottle_release_id_fk";

ALTER TABLE "store_price_match_attempt" DROP CONSTRAINT "store_price_match_attempt_suggested_release_id_bottle_release_id_fk";

ALTER TABLE "store_price_match_proposal" DROP CONSTRAINT "store_price_match_proposal_current_release_id_bottle_release_id_fk";

ALTER TABLE "store_price_match_proposal" DROP CONSTRAINT "store_price_match_proposal_suggested_release_id_bottle_release_id_fk";

ALTER TABLE "store_price" DROP CONSTRAINT "store_price_release_id_bottle_release_id_fk";

ALTER TABLE "tasting" DROP CONSTRAINT "tasting_release_id_bottle_release_id_fk";
