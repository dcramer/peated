import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottles,
  bottlesToDistillers,
  collectionBottles,
  entities,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { getReservedCollection } from "@peated/server/lib/db";
import {
  nameRank,
  plainTextSearchQuery,
  prefixTextSearchQuery,
} from "@peated/server/lib/search";
import { implement } from "@peated/server/orpc";
import librarySearchContract from "@peated/server/orpc/contracts/users/library-search";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";

export default implement(librarySearchContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const { query, limit } = input;

  const user = await getUserFromId(db, input.user, context.user);
  if (!user) {
    throw errors.NOT_FOUND({
      message: "User not found.",
    });
  }

  if (!(await profileVisible(db, user, context.user))) {
    throw errors.BAD_REQUEST({
      message: "User's profile is private.",
    });
  }

  const library = await getReservedCollection(db, user.id, "library");
  if (!library || !query) {
    return { entities: [], bottles: [] };
  }

  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);

  // Count each Library Bottle once per Entity, whatever role the Entity has.
  const roleCounts = await db.execute<{ entity_id: number; count: number }>(sql`
    SELECT entity_id, COUNT(DISTINCT bottle_id)::integer AS count
    FROM (
      SELECT ${bottles.brandId} AS entity_id, ${bottles.id} AS bottle_id
      FROM ${collectionBottles}
      JOIN ${bottles} ON ${bottles.id} = ${collectionBottles.bottleId}
      WHERE ${collectionBottles.collectionId} = ${library.id}
      UNION ALL
      SELECT ${bottles.bottlerId}, ${bottles.id}
      FROM ${collectionBottles}
      JOIN ${bottles} ON ${bottles.id} = ${collectionBottles.bottleId}
      WHERE ${collectionBottles.collectionId} = ${library.id}
        AND ${bottles.bottlerId} IS NOT NULL
      UNION ALL
      SELECT ${bottlesToDistillers.distillerId}, ${bottlesToDistillers.bottleId}
      FROM ${collectionBottles}
      JOIN ${bottlesToDistillers}
        ON ${bottlesToDistillers.bottleId} = ${collectionBottles.bottleId}
      WHERE ${collectionBottles.collectionId} = ${library.id}
    ) AS library_roles
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
            or(
              lt(entityRank, 3),
              sql`${entities.searchVector} @@ ${textQuery}`,
              sql`${entities.searchVector} @@ ${prefixQuery}`,
            ),
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
    .from(collectionBottles)
    .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
    .where(
      and(
        eq(collectionBottles.collectionId, library.id),
        or(
          referenceMatch,
          sql`${bottles.searchVector} @@ ${textQuery}`,
          sql`${bottles.searchVector} @@ ${prefixQuery}`,
        ),
      ),
    )
    .orderBy(
      bottleRank,
      sql`ts_rank(${bottles.searchVector}, ${textQuery}) DESC`,
      asc(bottles.fullName),
      asc(bottles.id),
    )
    .limit(limit);

  const [serializedEntities, serializedBottles] = await Promise.all([
    serialize(
      EntitySerializer,
      matchedEntities.map(({ entity }) => entity),
      context.user,
    ),
    serialize(
      BottleSerializer,
      bottleRows.map(({ bottle }) => bottle),
      context.user,
    ),
  ]);

  return {
    entities: serializedEntities.map((entity, index) => ({
      entity,
      count: matchedEntities[index]!.count,
    })),
    bottles: serializedBottles,
  };
});
