-- Store-price matching uses the Bottle classifier's words for a decision:
-- match, create_bottle, and no_match. A correction was a Match to a Bottle
-- other than the listing's current one; current_bottle_id still records that.
-- The transient verified status is gone: an eligible match is applied at once,
-- so any verified proposal left over returns to the review queue.
-- Scope: every row in these tables. The follow-up deploy runs the same
-- rewrite again before it removes the old values.

UPDATE "store_price_match_proposal"
SET "proposal_type" = CASE "proposal_type"
  WHEN 'match_existing' THEN 'match'
  WHEN 'correction' THEN 'match'
  WHEN 'create_new' THEN 'create_bottle'
  ELSE "proposal_type"
END
WHERE "proposal_type" IN ('match_existing', 'correction', 'create_new');
--> statement-breakpoint
UPDATE "store_price_match_proposal"
SET "status" = 'pending_review'
WHERE "status" = 'verified';
--> statement-breakpoint
UPDATE "store_price_match_attempt"
SET "proposal_type" = CASE "proposal_type"
  WHEN 'match_existing' THEN 'match'
  WHEN 'correction' THEN 'match'
  WHEN 'create_new' THEN 'create_bottle'
  ELSE "proposal_type"
END
WHERE "proposal_type" IN ('match_existing', 'correction', 'create_new');
--> statement-breakpoint
UPDATE "store_price_match_retry_run"
SET "kind" = CASE "kind"
  WHEN 'match_existing' THEN 'match'
  WHEN 'correction' THEN 'match'
  WHEN 'create_new' THEN 'create_bottle'
  ELSE "kind"
END
WHERE "kind" IN ('match_existing', 'correction', 'create_new');
--> statement-breakpoint
UPDATE "incoming_bottle_decision_log"
SET "decision" = 'match'
WHERE "decision" = 'match_existing';
