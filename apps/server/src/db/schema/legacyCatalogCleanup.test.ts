import { db } from "@peated/server/db";
import { sql } from "drizzle-orm";

test("legacy BottleRelease database objects are absent", async () => {
  const {
    rows: [state],
  } = await db.execute<{
    legacyTableCount: number;
    legacyColumnCount: number;
    legacyTypeCount: number;
  }>(sql`
    SELECT
      num_nonnulls(
        to_regclass('public.bottle_release'),
        to_regclass('public.bottle_release_promotion'),
        to_regclass('public.legacy_release_repair_review')
      )::int AS "legacyTableCount",
      (
        SELECT COUNT(*)::int
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (
            VALUES
              ('bottle_alias', 'release_id'),
              ('bottle_observation', 'release_id'),
              ('collection_bottle', 'release_id'),
              ('flight_bottle', 'release_id'),
              ('incoming_bottle_decision_log', 'release_id'),
              ('review', 'release_id'),
              ('store_price_match_attempt', 'current_release_id'),
              ('store_price_match_attempt', 'suggested_release_id'),
              ('store_price_match_attempt', 'parent_bottle_id'),
              ('store_price_match_attempt', 'creation_target'),
              ('store_price_match_proposal', 'current_release_id'),
              ('store_price_match_proposal', 'suggested_release_id'),
              ('store_price_match_proposal', 'parent_bottle_id'),
              ('store_price_match_proposal', 'creation_target'),
              ('store_price_match_proposal', 'proposed_release'),
              ('store_price', 'release_id'),
              ('tasting', 'release_id')
          )
      ) AS "legacyColumnCount",
      (
        SELECT COUNT(*)::int
        FROM pg_type
        INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname IN (
            'legacy_release_repair_review_resolution',
            'store_price_match_creation_target'
          )
      ) AS "legacyTypeCount"
  `);

  expect(state).toEqual({
    legacyTableCount: 0,
    legacyColumnCount: 0,
    legacyTypeCount: 0,
  });
});
