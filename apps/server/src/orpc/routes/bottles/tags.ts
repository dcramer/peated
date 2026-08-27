import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { implement } from "@peated/server/orpc";
import bottleTagsContract from "@peated/server/orpc/contracts/bottles/tags";
import { and, eq, sql } from "drizzle-orm";

export default implement(bottleTagsContract).handler(async function ({
  input,
  errors,
}) {
  try {
    return await db.transaction(async (tx) => {
      await resolveActiveBottleIds(tx, [input.bottle]);

      const results = await tx.query.bottleTags.findMany({
        where: (bottleTags, { eq }) => eq(bottleTags.bottleId, input.bottle),
        orderBy: (bottleTags, { desc }) => desc(bottleTags.count),
        limit: input.limit,
      });
      const [{ count }] = await tx
        .select({ count: sql<string>`COUNT(*)` })
        .from(tastings)
        .where(
          and(
            eq(tastings.bottleId, input.bottle),
            sql<boolean>`array_length(${tastings.tags}, 1) > 0`,
          ),
        );

      return {
        results: results.map(({ tag, count }) => ({ tag, count })),
        totalCount: Number(count),
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
});
