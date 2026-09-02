import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  tags,
  tastings,
  users,
} from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/tags/bottles";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

export default implement(contract).handler(async ({ input, context }) => {
  const selectedTags = await db
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.tagCategory, input.category),
        input.note
          ? sql`(lower(${tags.name}) = ${input.note.toLowerCase()} OR EXISTS (
      SELECT FROM unnest(${tags.synonyms}) AS synonym WHERE lower(synonym) = ${input.note.toLowerCase()}
    ))`
          : undefined,
      ),
    );
  const names = [
    ...new Set(selectedTags.flatMap((tag) => [tag.name, ...tag.synonyms])),
  ];
  if (!names.length) return { results: [] };

  // Public examples exclude private tastings, even for their author or followers.
  // A tasting counts once even when it contains several notes in the category.
  // Untagged tastings provide no evidence about flavor and are not in the denominator.
  const matches = sql`${tastings.tags} && ARRAY[${sql.join(
    names.map((name) => sql`${name}`),
    sql`, `,
  )}]::varchar[]`;
  const counts = db
    .select({
      bottleId: tastings.bottleId,
      matching: sql<number>`count(*) FILTER (WHERE ${matches})`
        .mapWith(Number)
        .as("matching"),
      tagged: sql<number>`count(*)`.mapWith(Number).as("tagged"),
    })
    .from(tastings)
    .innerJoin(users, eq(users.id, tastings.createdById))
    .where(
      and(eq(users.private, false), sql`cardinality(${tastings.tags}) > 0`),
    )
    .groupBy(tastings.bottleId)
    .having(sql`count(*) FILTER (WHERE ${matches}) > 0`)
    .as("note_counts");

  const rows = await db
    .select({
      bottle: bottles,
      matching: counts.matching,
      tagged: counts.tagged,
    })
    .from(counts)
    .innerJoin(bottles, eq(bottles.id, counts.bottleId))
    .where(
      and(
        isNotNull(bottles.groupId),
        sql`NOT EXISTS (
      SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id}
    )`,
      ),
    )
    .orderBy(
      desc(sql`${counts.matching}::numeric / ${counts.tagged}`),
      desc(counts.matching),
      asc(bottles.id),
    )
    .limit(input.limit);
  const serialized = await serialize(
    BottleSerializer,
    rows.map((row) => row.bottle),
    context.user,
  );
  return {
    results: rows.map((row, index) => ({
      bottle: serialized[index]!,
      matchingTastings: row.matching,
      taggedTastings: row.tagged,
    })),
  };
});
