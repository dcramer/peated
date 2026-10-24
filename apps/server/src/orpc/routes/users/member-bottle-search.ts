import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleReferences,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { nameRank } from "@peated/server/lib/nameRank";
import {
  bottleTextPredicate,
  entityTextPredicate,
  textSearchQuery,
} from "@peated/server/lib/textSearch";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { EntitySerializer } from "@peated/server/serializers/entity";
import type { SQL } from "drizzle-orm";
import { and, asc, inArray, lt, or, sql } from "drizzle-orm";

/**
 * Suggests Entities and Bottles from one member's set of Bottles while they
 * type. `memberBottleIds` is a subquery that selects one `bottle_id` column,
 * such as the Bottles in a Library or the Bottles a member has tasted.
 */
export async function searchMemberBottles({
  memberBottleIds,
  query,
  limit,
  viewer,
}: {
  memberBottleIds: SQL;
  query: string;
  limit: number;
  viewer: User | null;
}) {
  const textQuery = textSearchQuery(query, { prefix: true });

  // Count each member Bottle once per Entity, whatever role the Entity has.
  const roleCounts = await db.execute<{ entity_id: number; count: number }>(sql`
    WITH member_bottles AS (${memberBottleIds})
    SELECT entity_id, COUNT(DISTINCT bottle_id)::integer AS count
    FROM (
      SELECT ${bottles.brandId} AS entity_id, ${bottles.id} AS bottle_id
      FROM ${bottles}
      WHERE ${bottles.id} IN (SELECT bottle_id FROM member_bottles)
      UNION ALL
      SELECT ${bottles.bottlerId}, ${bottles.id}
      FROM ${bottles}
      WHERE ${bottles.id} IN (SELECT bottle_id FROM member_bottles)
        AND ${bottles.bottlerId} IS NOT NULL
      UNION ALL
      SELECT ${bottlesToDistillers.distillerId}, ${bottlesToDistillers.bottleId}
      FROM ${bottlesToDistillers}
      WHERE ${bottlesToDistillers.bottleId} IN (SELECT bottle_id FROM member_bottles)
    ) AS member_roles
    GROUP BY entity_id
  `);
  const countByEntityId = new Map(
    roleCounts.rows.map((row) => [Number(row.entity_id), Number(row.count)]),
  );

  const entityRank = nameRank(
    [sql`${entities.name}`, sql`${entities.shortName}`],
    query,
  );
  const entityRows = countByEntityId.size
    ? await db
        .select({ entity: entities, rank: entityRank })
        .from(entities)
        .where(
          and(
            inArray(entities.id, Array.from(countByEntityId.keys())),
            or(lt(entityRank, 3), entityTextPredicate(textQuery)),
          ),
        )
    : [];
  const matchedEntities = entityRows
    .map(({ entity, rank }) => ({
      entity,
      rank: Number(rank),
      count: countByEntityId.get(entity.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        right.count - left.count ||
        left.entity.name.localeCompare(right.entity.name) ||
        left.entity.id - right.entity.id,
    )
    .slice(0, limit);

  const referenceMatch = sql`EXISTS(
    SELECT FROM ${bottleReferences}
    WHERE ${bottleReferences.bottleId} = ${bottles.id}
      AND LOWER(${bottleReferences.name}) = ${query.toLowerCase()}
      AND ${bottleReferences.ignored} IS NOT TRUE
  )`;
  const bottleRank = nameRank(
    [sql`${bottles.fullName}`, sql`${bottles.name}`],
    query,
    referenceMatch,
  );
  const bottleRows = await db
    .select({ bottle: bottles })
    .from(bottles)
    .where(
      and(
        sql`${bottles.id} IN (${memberBottleIds})`,
        or(referenceMatch, bottleTextPredicate(textQuery)),
      ),
    )
    // tin.score needs a TIN index scan, and the member filter lets the planner
    // pick another plan (docs/architecture/bottle-search.md). A member's set is
    // small, so rank by name match alone.
    .orderBy(bottleRank, asc(bottles.fullName), asc(bottles.id))
    .limit(limit);

  const [serializedEntities, serializedBottles] = await Promise.all([
    serialize(
      EntitySerializer,
      matchedEntities.map(({ entity }) => entity),
      viewer,
    ),
    serialize(
      BottleSerializer,
      bottleRows.map(({ bottle }) => bottle),
      viewer,
      [],
      { includeGroupSummary: true },
    ),
  ]);

  return {
    entities: serializedEntities.map((entity, index) => ({
      entity,
      count: matchedEntities[index]!.count,
    })),
    bottles: serializedBottles,
  };
}
