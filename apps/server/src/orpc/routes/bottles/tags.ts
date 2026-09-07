import { db } from "@peated/server/db";
import { bottles, bottleTags } from "@peated/server/db/schema";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { implement } from "@peated/server/orpc";
import bottleTagsContract from "@peated/server/orpc/contracts/bottles/tags";
import { sql } from "drizzle-orm";

export default implement(bottleTagsContract).handler(async function ({
  input,
  errors,
}) {
  try {
    return await db.transaction(async (tx) => {
      await resolveActiveBottleIds(tx, [input.bottle]);

      const result = await tx.execute<{
        results: { tag: string; count: number }[];
        publicReviewAndTastingCount: number;
        totalCount: number;
      }>(sql`
        SELECT
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'tag', selected_tags.tag,
              'count', selected_tags.count
            ) ORDER BY selected_tags.count DESC, selected_tags.tag ASC)
            FROM (
              SELECT ${bottleTags.tag} AS tag, ${bottleTags.count} AS count
              FROM ${bottleTags}
              WHERE ${bottleTags.bottleId} = ${input.bottle}
              ORDER BY ${bottleTags.count} DESC, ${bottleTags.tag} ASC
              LIMIT ${input.limit}
            ) selected_tags
          ), '[]'::jsonb) AS results,
          ${bottles.publicReviewAndTastingCount}::integer
            AS "publicReviewAndTastingCount",
          ${bottles.publicReviewAndTastingCount}::integer AS "totalCount"
        FROM ${bottles}
        WHERE ${bottles.id} = ${input.bottle}
      `);
      const counts = result.rows[0];
      if (!counts)
        throw new Error("Bottle tasting-note query returned no result");

      return counts;
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
});
