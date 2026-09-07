import { db } from "@peated/server/db";
import {
  bottles,
  bottleTags,
  bottleTombstones,
  tags,
} from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import suggestedTagsContract from "@peated/server/orpc/contracts/bottles/suggested-tags";
import { and, eq, isNotNull, notExists, or, sql } from "drizzle-orm";

const COMMON_TASTING_NOTE_NAMES = [
  "vanilla",
  "caramel",
  "oak",
  "apple",
  "smoke",
] as const;

export default implement(suggestedTagsContract).handler(async function ({
  input,
  errors,
}) {
  const [bottle] = await db
    .select()
    .from(bottles)
    .where(
      and(
        eq(bottles.id, input.bottle),
        isNotNull(bottles.groupId),
        notExists(
          db
            .select({ bottleId: bottleTombstones.bottleId })
            .from(bottleTombstones)
            .where(eq(bottleTombstones.bottleId, bottles.id)),
        ),
      ),
    );

  if (!bottle) {
    throw errors.NOT_FOUND({
      message: "Bottle not found.",
    });
  }

  // TODO: change the logic to be weighted:
  // 1. high: recorded for this bottle (e.g. Hibiki 12-year-old)
  // 2. medium: recorded for this brand (e.g. Hibiki)
  // 3. low: recorded for this category (e.g. bourbon)
  const usedTags = Object.fromEntries(
    (
      await db.execute<{ tag: string; total: number }>(sql`
        SELECT ${bottleTags.tag} AS tag,
          SUM(${bottleTags.count})::integer AS total
        FROM ${bottleTags}
        INNER JOIN ${bottles} ON ${bottles.id} = ${bottleTags.bottleId}
        WHERE ${or(
          eq(bottleTags.bottleId, bottle.id),
          eq(bottles.brandId, bottle.brandId),
        )}
          AND ${bottles.groupId} IS NOT NULL
          AND NOT EXISTS (
            SELECT FROM ${bottleTombstones}
            WHERE ${bottleTombstones.bottleId} = ${bottles.id}
          )
        GROUP BY ${bottleTags.tag}
        ORDER BY total DESC, ${bottleTags.tag} ASC
      `)
    ).rows.map((t) => [t.tag, t.total]),
  );

  const defaultTags = await db.select().from(tags);

  const commonTagOrder = new Map<string, number>(
    COMMON_TASTING_NOTE_NAMES.map((name, index) => [name, index]),
  );
  const results = defaultTags
    .map((t) => ({
      tag: t,
      count: Number(usedTags[t.name] || 0),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (commonTagOrder.get(a.tag.name) ?? Number.MAX_SAFE_INTEGER) -
          (commonTagOrder.get(b.tag.name) ?? Number.MAX_SAFE_INTEGER) ||
        a.tag.name.localeCompare(b.tag.name),
    );

  return {
    results,
  };
});
