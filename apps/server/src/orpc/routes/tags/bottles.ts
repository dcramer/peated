import { db } from "@peated/server/db";
import {
  bottleNoteCategories,
  bottles,
  bottleTags,
  bottleTombstones,
  tags,
} from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/tags/bottles";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";

export default implement(contract).handler(async ({ input, context }) => {
  let counts: SQL;
  if (input.note) {
    const [selectedTag] = await db
      .select({ name: tags.name })
      .from(tags)
      .where(
        and(
          eq(tags.tagCategory, input.category),
          sql`(lower(${tags.name}) = ${input.note.toLowerCase()} OR EXISTS (
            SELECT FROM unnest(${tags.synonyms}) AS synonym
            WHERE lower(synonym) = ${input.note.toLowerCase()}
          ))`,
        ),
      )
      .orderBy(
        desc(sql`lower(${tags.name}) = ${input.note.toLowerCase()}`),
        tags.name,
      )
      .limit(1);
    if (!selectedTag) return { results: [] };
    counts = sql`
        SELECT ${bottleTags.bottleId} AS bottle_id,
          ${bottleTags.count}::integer AS matching
        FROM ${bottleTags}
        WHERE ${bottleTags.tag} = ${selectedTag.name}
      `;
  } else {
    counts = sql`
        SELECT ${bottleNoteCategories.bottleId} AS bottle_id,
          ${bottleNoteCategories.count}::integer AS matching
        FROM ${bottleNoteCategories}
        WHERE ${bottleNoteCategories.category} = ${input.category}
      `;
  }

  const result = await db.execute<{
    bottleId: number;
    matching: number;
    tagged: number;
  }>(sql`
    SELECT ${bottles.id} AS "bottleId",
      note_counts.matching,
      ${bottles.notedReviewAndTastingCount}::integer AS tagged
    FROM (${counts}) AS note_counts
    INNER JOIN ${bottles} ON ${bottles.id} = note_counts.bottle_id
    WHERE ${bottles.groupId} IS NOT NULL
      AND NOT EXISTS (
        SELECT FROM ${bottleTombstones}
        WHERE ${bottleTombstones.bottleId} = ${bottles.id}
      )
      AND ${bottles.notedReviewAndTastingCount} > 0
    ORDER BY note_counts.matching::numeric /
        ${bottles.notedReviewAndTastingCount} DESC,
      note_counts.matching DESC, ${bottles.id} ASC
    LIMIT ${input.limit}
  `);
  const rows = result.rows.map((row) => ({
    bottleId: Number(row.bottleId),
    matching: Number(row.matching),
    tagged: Number(row.tagged),
  }));
  const selectedBottles = rows.length
    ? await db.query.bottles.findMany({
        where: (bottles, { inArray }) =>
          inArray(
            bottles.id,
            rows.map((row) => row.bottleId),
          ),
      })
    : [];
  const bottlesById = new Map(
    selectedBottles.map((bottle) => [bottle.id, bottle]),
  );
  const serialized = await serialize(
    BottleSerializer,
    rows.map((row) => bottlesById.get(row.bottleId)!),
    context.user,
  );
  return {
    results: rows.map((row, index) => ({
      bottle: serialized[index]!,
      matchingReviewAndTastingCount: row.matching,
      notedReviewAndTastingCount: row.tagged,
      matchingTastings: row.matching,
      taggedTastings: row.tagged,
    })),
  };
});
