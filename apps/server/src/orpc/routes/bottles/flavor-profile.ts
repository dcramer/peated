import { TAG_CATEGORIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleNoteCategories,
  bottles,
  bottleTags,
  tags,
} from "@peated/server/db/schema";
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

        // Bottle flavor profiles are public. Each public review or tasting
        // counts once per category, regardless of repeated notes in it.
        const result = await tx.execute<BottleFlavorProfile>(sql`
        WITH category_counts AS (
          SELECT ${bottleNoteCategories.category} AS category,
            ${bottleNoteCategories.count} AS review_and_tasting_count
          FROM ${bottleNoteCategories}
          WHERE ${bottleNoteCategories.bottleId} = ${input.bottle}
        ), ranked_notes AS (
          SELECT ${tags.tagCategory} AS category, ${bottleTags.tag} AS name,
            ${bottleTags.count} AS review_and_tasting_count,
            ROW_NUMBER() OVER (
              PARTITION BY ${tags.tagCategory}
              ORDER BY ${bottleTags.count} DESC, ${bottleTags.tag} ASC
            ) AS rank
          FROM ${bottleTags}
          INNER JOIN ${tags} ON ${tags.name} = ${bottleTags.tag}
          WHERE ${bottleTags.bottleId} = ${input.bottle}
        )
        SELECT
          ${bottles.notedReviewAndTastingCount}::integer
            AS "notedReviewAndTastingCount",
          ${bottles.notedReviewAndTastingCount}::integer AS "notedTastings",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'category', category_counts.category,
              'reviewAndTastingCount', category_counts.review_and_tasting_count,
              'tastingCount', category_counts.review_and_tasting_count,
              'notes', (
                SELECT jsonb_agg(jsonb_build_object(
                  'name', ranked_notes.name,
                  'reviewAndTastingCount', ranked_notes.review_and_tasting_count,
                  'tastingCount', ranked_notes.review_and_tasting_count
                ) ORDER BY ranked_notes.rank)
                FROM ranked_notes
                WHERE ranked_notes.category = category_counts.category
                  AND ranked_notes.rank <= 2
              )
            )) FROM category_counts
          ), '[]'::jsonb) AS categories
        FROM ${bottles}
        WHERE ${bottles.id} = ${input.bottle}
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
                reviewAndTastingCount: 0,
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
