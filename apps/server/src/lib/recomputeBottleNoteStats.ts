import type { AnyTransaction } from "@peated/server/db";
import {
  bottleNoteCategories,
  bottleTags,
  tags,
} from "@peated/server/db/schema";
import { publicReviewsAndTastings } from "@peated/server/lib/publicReviewsAndTastings";
import { TagCategoryEnum } from "@peated/server/schemas";
import { eq, sql } from "drizzle-orm";

type CountedName = { name: string; count: number };
type RawBottleNoteStats = {
  publicReviewAndTastingCount: number | string;
  notedReviewAndTastingCount: number | string;
  tagCounts: CountedName[];
  categoryCounts: CountedName[];
};

export type BottleNoteStats = {
  publicReviewAndTastingCount: number;
  notedReviewAndTastingCount: number;
};

function readCount(value: number | string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Bottle note summary returned an invalid count.");
  }
  return count;
}

/** Rebuilds one Bottle's anonymous-public tag and category summaries. */
export async function recomputeBottleNoteStatsInTransaction(
  tx: AnyTransaction,
  bottleId: number,
): Promise<BottleNoteStats> {
  const result = await tx.execute<RawBottleNoteStats>(sql`
    WITH public_reviews_and_tastings AS MATERIALIZED (
      ${publicReviewsAndTastings([bottleId])}
    ), recognized_notes AS MATERIALIZED (
      SELECT DISTINCT public_reviews_and_tastings.kind,
        public_reviews_and_tastings.review_or_tasting_id,
        recognized_tag.name, recognized_tag.category
      FROM public_reviews_and_tastings
      CROSS JOIN LATERAL
        unnest(public_reviews_and_tastings.note_names) AS note(name)
      CROSS JOIN LATERAL (
        SELECT ${tags.name} AS name, ${tags.tagCategory} AS category
        FROM ${tags}
        WHERE ${tags.name} = note.name OR note.name = ANY(${tags.synonyms})
        ORDER BY (${tags.name} = note.name) DESC, ${tags.name}
        LIMIT 1
      ) AS recognized_tag
    ), tag_counts AS (
      SELECT name, COUNT(*)::integer AS count
      FROM recognized_notes
      GROUP BY name
    ), category_counts AS (
      SELECT category AS name,
        COUNT(DISTINCT (kind, review_or_tasting_id))::integer AS count
      FROM recognized_notes
      GROUP BY category
    )
    SELECT
      (SELECT COUNT(*) FROM public_reviews_and_tastings)
        AS "publicReviewAndTastingCount",
      (SELECT COUNT(DISTINCT (kind, review_or_tasting_id)) FROM recognized_notes)
        AS "notedReviewAndTastingCount",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'count', count))
        FROM tag_counts
      ), '[]'::jsonb) AS "tagCounts",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'count', count))
        FROM category_counts
      ), '[]'::jsonb) AS "categoryCounts"
  `);
  const row = result.rows[0];
  if (!row) throw new Error("Bottle note summary returned no result.");

  await tx.delete(bottleTags).where(eq(bottleTags.bottleId, bottleId));
  if (row.tagCounts.length) {
    await tx.insert(bottleTags).values(
      row.tagCounts.map(({ name, count }) => ({
        bottleId,
        tag: name,
        count: readCount(count),
      })),
    );
  }

  await tx
    .delete(bottleNoteCategories)
    .where(eq(bottleNoteCategories.bottleId, bottleId));
  if (row.categoryCounts.length) {
    await tx.insert(bottleNoteCategories).values(
      row.categoryCounts.map(({ name, count }) => ({
        bottleId,
        category: TagCategoryEnum.parse(name),
        count: readCount(count),
      })),
    );
  }

  return {
    publicReviewAndTastingCount: readCount(row.publicReviewAndTastingCount),
    notedReviewAndTastingCount: readCount(row.notedReviewAndTastingCount),
  };
}
