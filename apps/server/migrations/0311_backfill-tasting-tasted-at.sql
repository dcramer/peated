-- Tastings now record when the dram was had (tasted_at) apart from when the
-- tasting was posted (created_at). Before this change, created_at held the
-- tasted time the member chose, so it is the best value for existing rows.
-- Scope: every tasting without a tasted_at.
UPDATE "tasting" SET "tasted_at" = "created_at" WHERE "tasted_at" IS NULL;
