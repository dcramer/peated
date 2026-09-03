import { TAG_CATEGORIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { tags, tastings, users } from "@peated/server/db/schema";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { implement } from "@peated/server/orpc";
import flavorProfileContract from "@peated/server/orpc/contracts/bottles/flavor-profile";
import type { BottleFlavorProfile } from "@peated/server/schemas/flavorProfile";
import { sql } from "drizzle-orm";

export default implement(flavorProfileContract).handler(
  async ({ input, errors }) => {
    try {
      return await db.transaction(async (tx) => {
        await resolveActiveBottleIds(tx, [input.bottle]);

        // Bottle flavor profiles are public: this route excludes private notes,
        // even for their author, and counts each tasting once per category.
        const result = await tx.execute<BottleFlavorProfile>(sql`
        WITH public_notes AS MATERIALIZED (
          SELECT DISTINCT ${tastings.id} AS tasting_id,
            ${tags.name} AS name, ${tags.tagCategory} AS category
          FROM ${tastings}
          INNER JOIN ${users} ON ${users.id} = ${tastings.createdById}
            AND ${users.private} = FALSE
          CROSS JOIN LATERAL unnest(${tastings.tags}) AS note(name)
          INNER JOIN ${tags} ON ${tags.name} = note.name
          WHERE ${tastings.bottleId} = ${input.bottle}
        ), category_counts AS (
          SELECT category, COUNT(DISTINCT tasting_id)::integer AS tasting_count
          FROM public_notes GROUP BY category
        ), ranked_notes AS (
          SELECT category, name, COUNT(*)::integer AS tasting_count,
            ROW_NUMBER() OVER (
              PARTITION BY category ORDER BY COUNT(*) DESC, name ASC
            ) AS rank
          FROM public_notes GROUP BY category, name
        )
        SELECT
          (SELECT COUNT(DISTINCT tasting_id)::integer FROM public_notes) AS "notedTastings",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'category', category_counts.category,
              'tastingCount', category_counts.tasting_count,
              'notes', (
                SELECT jsonb_agg(jsonb_build_object(
                  'name', ranked_notes.name,
                  'tastingCount', ranked_notes.tasting_count
                ) ORDER BY ranked_notes.rank)
                FROM ranked_notes
                WHERE ranked_notes.category = category_counts.category
                  AND ranked_notes.rank <= 2
              )
            )) FROM category_counts
          ), '[]'::jsonb) AS categories
      `);
        const profile = result.rows[0];
        if (!profile)
          throw new Error("Bottle flavor profile query returned no result");

        return {
          ...profile,
          categories: TAG_CATEGORIES.map(
            (category) =>
              profile.categories.find((item) => item.category === category) ?? {
                category,
                tastingCount: 0,
                notes: [],
              },
          ),
        };
      });
    } catch (error) {
      if (error instanceof ActiveBottleSelectionError) {
        if (error.reason === "missing") {
          throw errors.NOT_FOUND({ message: error.message, cause: error });
        }
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  },
);
