import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetNotFoundError,
  loadCatalogTargetBatch,
  loadCatalogTargetByGroupId,
} from "@peated/server/lib/catalogTargets";
import {
  BottleGroupAliasV1Schema,
  type BottleGroupAliasV1,
  type ExactCatalogTargetV1,
  type GenericCatalogTargetV1,
} from "@peated/server/schemas";
import type { CatalogIdentitySerializerContext } from "@peated/server/serializers/catalogIdentity";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

export const BOTTLE_GROUP_SORT_OPTIONS = [
  "name",
  "-name",
  "created",
  "-created",
  "rating",
  "-rating",
  "tastings",
  "-tastings",
  "bottles",
  "-bottles",
] as const;

export type BottleGroupSort = (typeof BOTTLE_GROUP_SORT_OPTIONS)[number];

export const BOTTLE_GROUP_BOTTLE_SORT_OPTIONS = [
  "name",
  "-name",
  "created",
  "-created",
  "age",
  "-age",
  "rating",
  "-rating",
  "tastings",
  "-tastings",
  "releaseYear",
  "-releaseYear",
] as const;

export type BottleGroupBottleSort =
  (typeof BOTTLE_GROUP_BOTTLE_SORT_OPTIONS)[number];

export type BottleGroupListInput = {
  query: string;
  cursor: number;
  limit: number;
  sort: BottleGroupSort;
};

export type BottleGroupBottleListInput = {
  query: string;
  cursor: number;
  limit: number;
  sort: BottleGroupBottleSort;
};

export type BottleGroupAliasListInput = {
  cursor: number;
  limit: number;
};

type CursorRel = {
  nextCursor: number | null;
  prevCursor: number | null;
};

export type BottleGroupListResult = {
  results: GenericCatalogTargetV1[];
  rel: CursorRel;
};

export type BottleGroupBottleListResult = {
  results: ExactCatalogTargetV1[];
  rel: CursorRel;
};

export type BottleGroupAliasListResult = {
  results: BottleGroupAliasV1[];
  rel: CursorRel;
};

function cursorRel(
  cursor: number,
  limit: number,
  returnedRows: number,
): CursorRel {
  return {
    nextCursor: returnedRows > limit ? cursor + 1 : null,
    prevCursor: cursor > 1 ? cursor - 1 : null,
  };
}

function groupOrderBy(sort: BottleGroupSort): SQL<unknown>[] {
  switch (sort) {
    case "name":
      return [asc(bottleGroups.fullName), asc(bottleGroups.id)];
    case "-name":
      return [desc(bottleGroups.fullName), desc(bottleGroups.id)];
    case "created":
      return [asc(bottleGroups.createdAt), asc(bottleGroups.id)];
    case "-created":
      return [desc(bottleGroups.createdAt), desc(bottleGroups.id)];
    case "rating":
      return [
        sql`${bottleGroups.avgRating} ASC NULLS LAST`,
        asc(bottleGroups.id),
      ];
    case "-rating":
      return [
        sql`${bottleGroups.avgRating} DESC NULLS LAST`,
        asc(bottleGroups.id),
      ];
    case "tastings":
      return [asc(bottleGroups.totalTastings), asc(bottleGroups.id)];
    case "-tastings":
      return [desc(bottleGroups.totalTastings), asc(bottleGroups.id)];
    case "bottles":
      return [asc(bottleGroups.totalBottles), asc(bottleGroups.id)];
    case "-bottles":
      return [desc(bottleGroups.totalBottles), asc(bottleGroups.id)];
  }
}

function bottleOrderBy(sort: BottleGroupBottleSort): SQL<unknown>[] {
  switch (sort) {
    case "name":
      return [asc(bottles.fullName), asc(bottles.id)];
    case "-name":
      return [desc(bottles.fullName), desc(bottles.id)];
    case "created":
      return [asc(bottles.createdAt), asc(bottles.id)];
    case "-created":
      return [desc(bottles.createdAt), desc(bottles.id)];
    case "age":
      return [sql`${bottles.statedAge} ASC NULLS FIRST`, asc(bottles.id)];
    case "-age":
      return [sql`${bottles.statedAge} DESC NULLS LAST`, asc(bottles.id)];
    case "rating":
      return [sql`${bottles.avgRating} ASC NULLS LAST`, asc(bottles.id)];
    case "-rating":
      return [sql`${bottles.avgRating} DESC NULLS LAST`, asc(bottles.id)];
    case "tastings":
      return [asc(bottles.totalTastings), asc(bottles.id)];
    case "-tastings":
      return [desc(bottles.totalTastings), asc(bottles.id)];
    case "releaseYear":
      return [sql`${bottles.releaseYear} ASC NULLS FIRST`, asc(bottles.id)];
    case "-releaseYear":
      return [sql`${bottles.releaseYear} DESC NULLS LAST`, asc(bottles.id)];
  }
}

async function hydrateGroupTargets(
  rows: { groupId: number; targetId: number | null }[],
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase,
): Promise<GenericCatalogTargetV1[]> {
  const targetIds = rows.flatMap(({ targetId }) =>
    targetId === null ? [] : [targetId],
  );
  const targetResults = await loadCatalogTargetBatch(
    targetIds,
    context,
    database,
  );

  return rows.map(({ groupId, targetId }) => {
    if (targetId === null) {
      throw new CatalogTargetIntegrityMismatchError(
        { groupId },
        "the BottleGroup has no generic target",
      );
    }
    const resolution = targetResults.get(targetId);
    if (!resolution) {
      throw new CatalogTargetIntegrityMismatchError(
        { groupId },
        "the BottleGroup generic target could not be hydrated",
      );
    }
    if (!resolution.ok) throw resolution.error;
    if (
      resolution.target.kind !== "group" ||
      resolution.target.group.id !== groupId
    ) {
      throw new CatalogTargetIntegrityMismatchError(
        { groupId },
        "the BottleGroup list row did not resolve to its generic target",
      );
    }
    return resolution.target;
  });
}

async function hydrateBottleTargets(
  rows: {
    bottleId: number;
    groupId: number | null;
    targetId: number | null;
  }[],
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase,
): Promise<ExactCatalogTargetV1[]> {
  const targetIds = rows.flatMap(({ targetId }) =>
    targetId === null ? [] : [targetId],
  );
  const targetResults = await loadCatalogTargetBatch(
    targetIds,
    context,
    database,
  );

  return rows.map(({ bottleId, groupId, targetId }) => {
    if (groupId === null) {
      throw new CatalogTargetIntegrityMismatchError(
        { bottleId },
        "the related Bottle has no BottleGroup",
      );
    }
    if (targetId === null) {
      throw new CatalogTargetIntegrityMismatchError(
        { bottleId },
        "the related Bottle has no exact target",
      );
    }
    const resolution = targetResults.get(targetId);
    if (!resolution) {
      throw new CatalogTargetIntegrityMismatchError(
        { bottleId },
        "the related Bottle target could not be hydrated",
      );
    }
    if (!resolution.ok) throw resolution.error;
    if (
      resolution.target.kind !== "bottle" ||
      resolution.target.bottle.id !== bottleId ||
      resolution.target.group.id !== groupId
    ) {
      throw new CatalogTargetIntegrityMismatchError(
        { bottleId },
        "the related Bottle row did not resolve to its exact target",
      );
    }
    return resolution.target;
  });
}

/** Lists active BottleGroups as their generic CatalogTargets. */
export async function listBottleGroups(
  input: BottleGroupListInput,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<BottleGroupListResult> {
  const query = input.query.trim();
  const offset = (input.cursor - 1) * input.limit;
  const where = [
    isNull(catalogTargets.bottleId),
    sql`NOT EXISTS(SELECT FROM ${bottleGroupTombstones} WHERE ${bottleGroupTombstones.groupId} = ${bottleGroups.id})`,
  ];
  if (query) {
    const pattern = `%${query}%`;
    where.push(
      or(
        ilike(bottleGroups.name, pattern),
        ilike(bottleGroups.fullName, pattern),
        sql`EXISTS(SELECT FROM ${bottleAliases} WHERE ${bottleAliases.targetId} = ${catalogTargets.id} AND ${bottleAliases.ignored} IS NOT TRUE AND ${bottleAliases.name} ILIKE ${pattern})`,
      )!,
    );
  }

  const rows = await database
    .select({ groupId: bottleGroups.id, targetId: catalogTargets.id })
    .from(bottleGroups)
    .leftJoin(
      catalogTargets,
      and(
        eq(catalogTargets.groupId, bottleGroups.id),
        isNull(catalogTargets.bottleId),
      ),
    )
    .where(and(...where))
    .orderBy(...groupOrderBy(input.sort))
    .limit(input.limit + 1)
    .offset(offset);

  return {
    results: await hydrateGroupTargets(
      rows.slice(0, input.limit),
      context,
      database,
    ),
    rel: cursorRel(input.cursor, input.limit, rows.length),
  };
}

/** Loads one BottleGroup only through its generic CatalogTarget. */
export async function loadBottleGroup(
  groupId: number,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<GenericCatalogTargetV1> {
  let target;
  try {
    target = await loadCatalogTargetByGroupId(groupId, context, database);
  } catch (error) {
    if (error instanceof CatalogTargetNotFoundError) {
      const group = await database.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, groupId),
        columns: { id: true },
      });
      if (group) {
        throw new CatalogTargetIntegrityMismatchError(
          { groupId },
          "the BottleGroup has no generic target",
        );
      }
    }
    throw error;
  }
  if (target.kind !== "group" || target.group.id !== groupId) {
    throw new CatalogTargetIntegrityMismatchError(
      { groupId },
      "the BottleGroup did not resolve to its generic target",
    );
  }
  return target;
}

/** Lists active member Bottles as exact targets without deriving Bottle identity from the group. */
export async function listBottleGroupBottles(
  groupId: number,
  input: BottleGroupBottleListInput,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<BottleGroupBottleListResult> {
  await loadBottleGroup(groupId, context, database);

  const query = input.query.trim();
  const offset = (input.cursor - 1) * input.limit;
  const where = [
    eq(bottles.groupId, groupId),
    sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
  ];
  if (query) {
    const pattern = `%${query}%`;
    where.push(
      or(
        ilike(bottles.name, pattern),
        ilike(bottles.fullName, pattern),
        sql`EXISTS(SELECT FROM ${bottleAliases} WHERE ${bottleAliases.targetId} = ${catalogTargets.id} AND ${bottleAliases.ignored} IS NOT TRUE AND ${bottleAliases.name} ILIKE ${pattern})`,
      )!,
    );
  }

  const rows = await database
    .select({
      bottleId: bottles.id,
      groupId: bottles.groupId,
      targetId: catalogTargets.id,
    })
    .from(bottles)
    .leftJoin(
      catalogTargets,
      and(
        eq(catalogTargets.bottleId, bottles.id),
        eq(catalogTargets.groupId, bottles.groupId),
      ),
    )
    .where(and(...where))
    .orderBy(...bottleOrderBy(input.sort))
    .limit(input.limit + 1)
    .offset(offset);

  return {
    results: await hydrateBottleTargets(
      rows.slice(0, input.limit),
      context,
      database,
    ),
    rel: cursorRel(input.cursor, input.limit, rows.length),
  };
}

/** Lists only accepted aliases that directly own the group's generic target. */
export async function listBottleGroupAliases(
  groupId: number,
  input: BottleGroupAliasListInput,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<BottleGroupAliasListResult> {
  const group = await loadBottleGroup(groupId, context, database);
  const offset = (input.cursor - 1) * input.limit;
  const rows = await database
    .select({
      name: bottleAliases.name,
      assignmentSource: bottleAliases.assignmentSource,
      createdAt: bottleAliases.createdAt,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(bottleAliases.targetId, group.targetId),
        sql`${bottleAliases.ignored} IS NOT TRUE`,
      ),
    )
    .orderBy(asc(sql`LOWER(${bottleAliases.name})`), asc(bottleAliases.name))
    .limit(input.limit + 1)
    .offset(offset);

  return {
    results: rows.slice(0, input.limit).map((row) =>
      BottleGroupAliasV1Schema.parse({
        name: row.name,
        assignmentSource: row.assignmentSource,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    rel: cursorRel(input.cursor, input.limit, rows.length),
  };
}
