-- tasted_at becomes required in the next migration. Migration 0311 filled it
-- for tastings that existed then; old API code could still post tastings
-- without it until the release with tastedAt finished deploying. Those rows
-- held the member's chosen time in created_at, as before.
-- Scope: every tasting without a tasted_at.
UPDATE "tasting" SET "tasted_at" = "created_at" WHERE "tasted_at" IS NULL;
