-- Remove legacy cask fields from stored price match candidate family context.
-- Runtime writers no longer produce these fields, but old queued proposals can
-- still contain them in candidate_bottles snapshots.
CREATE FUNCTION pg_temp.strip_legacy_price_match_cask_traits(traits jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(traits) = 'array' THEN
      COALESCE(
        (
          SELECT jsonb_agg(trait ORDER BY ord)
          FROM jsonb_array_elements(traits) WITH ORDINALITY AS value(trait, ord)
          WHERE trait NOT IN (
            '"caskFill"'::jsonb,
            '"caskSize"'::jsonb,
            '"caskType"'::jsonb
          )
        ),
        '[]'::jsonb
      )
    ELSE traits
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.strip_legacy_price_match_cask_sibling(sibling jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(sibling) = 'object' THEN
      CASE
        WHEN jsonb_typeof(sibling->'traitFields') = 'array' THEN
          jsonb_set(
            sibling - 'caskFill' - 'caskSize' - 'caskType',
            '{traitFields}',
            pg_temp.strip_legacy_price_match_cask_traits(sibling->'traitFields'),
            false
          )
        ELSE sibling - 'caskFill' - 'caskSize' - 'caskType'
      END
    ELSE sibling
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.strip_legacy_price_match_cask_siblings(siblings jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(siblings) = 'array' THEN
      COALESCE(
        (
          SELECT jsonb_agg(
            pg_temp.strip_legacy_price_match_cask_sibling(sibling)
            ORDER BY ord
          )
          FROM jsonb_array_elements(siblings) WITH ORDINALITY AS value(sibling, ord)
        ),
        '[]'::jsonb
      )
    ELSE siblings
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.strip_legacy_price_match_candidate_family_context(
  family_context jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH parent_normalized AS (
    SELECT CASE
      WHEN jsonb_typeof(family_context) = 'object'
        AND jsonb_typeof(family_context->'parentBottleReleaseTraits') = 'array'
      THEN jsonb_set(
        family_context,
        '{parentBottleReleaseTraits}',
        pg_temp.strip_legacy_price_match_cask_traits(
          family_context->'parentBottleReleaseTraits'
        ),
        false
      )
      ELSE family_context
    END AS value
  ),
  release_normalized AS (
    SELECT CASE
      WHEN jsonb_typeof(value->'siblingReleases') = 'array'
      THEN jsonb_set(
        value,
        '{siblingReleases}',
        pg_temp.strip_legacy_price_match_cask_siblings(value->'siblingReleases'),
        false
      )
      ELSE value
    END AS value
    FROM parent_normalized
  ),
  bottle_normalized AS (
    SELECT CASE
      WHEN jsonb_typeof(value->'siblingBottles') = 'array'
      THEN jsonb_set(
        value,
        '{siblingBottles}',
        pg_temp.strip_legacy_price_match_cask_siblings(value->'siblingBottles'),
        false
      )
      ELSE value
    END AS value
    FROM release_normalized
  )
  SELECT value FROM bottle_normalized
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.strip_legacy_price_match_candidate(candidate jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(candidate) = 'object'
      AND jsonb_typeof(candidate->'familyContext') = 'object'
    THEN jsonb_set(
      candidate,
      '{familyContext}',
      pg_temp.strip_legacy_price_match_candidate_family_context(
        candidate->'familyContext'
      ),
      false
    )
    ELSE candidate
  END
$$;
--> statement-breakpoint
WITH normalized AS (
  SELECT
    proposal.id,
    jsonb_agg(
      pg_temp.strip_legacy_price_match_candidate(candidate)
      ORDER BY ord
    ) AS candidate_bottles
  FROM "store_price_match_proposal" proposal
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(proposal."candidate_bottles") = 'array'
        THEN proposal."candidate_bottles"
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS value(candidate, ord)
  GROUP BY proposal.id
)
UPDATE "store_price_match_proposal" proposal
SET "candidate_bottles" = normalized.candidate_bottles
FROM normalized
WHERE proposal.id = normalized.id
  AND proposal."candidate_bottles" IS DISTINCT FROM normalized.candidate_bottles;
