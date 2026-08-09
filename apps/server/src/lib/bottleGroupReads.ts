import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleTombstones,
  type User,
} from "@peated/server/db/schema";
import { BottleSchema, type BottleGroupV1 } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { BottleGroupSummarySerializer } from "@peated/server/serializers/catalogIdentity";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

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

export type BottleGroupBottleListInput = {
  query: string;
  cursor: number;
  limit: number;
  sort: BottleGroupBottleSort;
};

type CursorRel = {
  nextCursor: number | null;
  prevCursor: number | null;
};

export type BottleGroupBottleListResult = {
  results: z.infer<typeof BottleSchema>[];
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

export class BottleGroupNotFoundError extends Error {
  constructor(public readonly groupId: number) {
    super(`Bottle Group not found (groupId=${groupId}).`);
  }
}

async function loadActiveBottleGroup(groupId: number, database: AnyDatabase) {
  const [group] = await database
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .limit(1);

  if (!group) {
    throw new BottleGroupNotFoundError(groupId);
  }
  return group;
}

/** Loads one active BottleGroup as relationship and aggregate context. */
export async function loadBottleGroup(
  groupId: number,
  database: AnyDatabase = db,
): Promise<BottleGroupV1> {
  const group = await loadActiveBottleGroup(groupId, database);
  const distillers = await database
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, groupId));

  return await serialize(
    BottleGroupSummarySerializer,
    {
      ...group,
      distillerIds: distillers.map(({ distillerId }) => distillerId),
    },
    undefined,
    [],
    {
      actor: null,
      permissions: { canReadCatalogIdentity: true },
    },
  );
}

/** Lists active, independently complete member Bottles with stable pagination. */
export async function listBottleGroupBottles(
  groupId: number,
  input: BottleGroupBottleListInput,
  currentUser?: User,
): Promise<BottleGroupBottleListResult> {
  const group = await loadBottleGroup(groupId);

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
        sql`EXISTS(SELECT FROM ${bottleAliases} WHERE ${bottleAliases.bottleId} = ${bottles.id} AND ${bottleAliases.ignored} IS NOT TRUE AND ${bottleAliases.name} ILIKE ${pattern})`,
      )!,
    );
  }

  const rows = await db
    .select()
    .from(bottles)
    .where(and(...where))
    .orderBy(...bottleOrderBy(input.sort))
    .limit(input.limit + 1)
    .offset(offset);
  const serialized = await serialize(
    BottleSerializer,
    rows.slice(0, input.limit),
    currentUser,
  );

  return {
    results: serialized.map((bottle) =>
      BottleSchema.parse({ ...bottle, group }),
    ),
    rel: cursorRel(input.cursor, input.limit, rows.length),
  };
}
