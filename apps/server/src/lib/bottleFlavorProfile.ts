import { TAG_CATEGORIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  tags,
  tastings,
  users,
} from "@peated/server/db/schema";
import type { FlavorProfile } from "@peated/server/schemas/flavorProfile";
import { sql, type SQL } from "drizzle-orm";

/** Counts distinct active bottles with categorized public tasting notes. */
export async function getBottleFlavorProfile(
  scope: SQL,
): Promise<FlavorProfile> {
  // This public aggregate never includes private tastings, even for their author
  // or followers. Count a bottle once per family, regardless of repeat tastings.
  const result = await db.execute<FlavorProfile>(sql`
    WITH scoped_bottles AS MATERIALIZED (
      SELECT ${bottles.id} AS id FROM ${bottles}
      WHERE ${bottles.groupId} IS NOT NULL
        AND NOT EXISTS (
          SELECT FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
        AND ${scope}
    ), public_notes AS MATERIALIZED (
      SELECT DISTINCT scoped_bottles.id AS bottle_id,
        ${tags.name} AS name, ${tags.tagCategory} AS category
      FROM scoped_bottles
      INNER JOIN ${tastings} ON ${tastings.bottleId} = scoped_bottles.id
      INNER JOIN ${users} ON ${users.id} = ${tastings.createdById}
        AND ${users.private} = FALSE
      CROSS JOIN LATERAL unnest(${tastings.tags}) AS note(name)
      INNER JOIN ${tags} ON ${tags.name} = note.name
    ), category_counts AS (
      SELECT category, COUNT(DISTINCT bottle_id)::integer AS bottle_count
      FROM public_notes GROUP BY category
    ), ranked_notes AS (
      SELECT category, name, COUNT(*)::integer AS bottle_count,
        ROW_NUMBER() OVER (
          PARTITION BY category ORDER BY COUNT(*) DESC, name ASC
        ) AS rank
      FROM public_notes GROUP BY category, name
    )
    SELECT
      (SELECT COUNT(*)::integer FROM scoped_bottles) AS "totalBottles",
      (SELECT COUNT(DISTINCT bottle_id)::integer FROM public_notes) AS "notedBottles",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'category', category_counts.category,
          'bottleCount', category_counts.bottle_count,
          'notes', (
            SELECT jsonb_agg(jsonb_build_object(
              'name', ranked_notes.name,
              'bottleCount', ranked_notes.bottle_count
            ) ORDER BY ranked_notes.rank)
            FROM ranked_notes
            WHERE ranked_notes.category = category_counts.category
              AND ranked_notes.rank <= 2
          )
        )) FROM category_counts
      ), '[]'::jsonb) AS categories
  `);
  const profile = result.rows[0];
  if (!profile) throw new Error("Flavor profile query returned no result");

  return {
    ...profile,
    categories: TAG_CATEGORIES.map(
      (category) =>
        profile.categories.find((item) => item.category === category) ?? {
          category,
          bottleCount: 0,
          notes: [],
        },
    ),
  };
}
