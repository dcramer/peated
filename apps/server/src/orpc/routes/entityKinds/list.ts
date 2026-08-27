import { db } from "@peated/server/db";
import {
  countries,
  entities,
  entityAliases,
  regions,
  type EntityKind,
  type User,
} from "@peated/server/db/schema";
import {
  plainTextSearchQuery,
  prefixTextSearchQuery,
} from "@peated/server/lib/search";
import type { EntityKindListInputSchema } from "@peated/server/orpc/contracts/entityKinds/list";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { z } from "zod";

type Input = z.infer<typeof EntityKindListInputSchema>;

type ListEntitiesOptions = {
  badRequest: (message: string) => never;
  currentUser?: User | null;
  input: Input;
};

export async function listEntities({
  badRequest,
  currentUser,
  input,
  kind,
}: ListEntitiesOptions & { kind?: EntityKind }) {
  const { query, cursor, limit } = input;
  const offset = (cursor - 1) * limit;
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  const where: (SQL<unknown> | undefined)[] = [
    kind ? eq(entities.kind, kind) : undefined,
  ];

  if (input.owner) {
    where.push(eq(entities.ownerId, input.owner));
  }

  if (query) {
    where.push(
      or(
        sql`${entities.searchVector} @@ ${textQuery}`,
        sql`${entities.searchVector} @@ ${prefixQuery}`,
      ),
    );
  }
  if (input.name) {
    where.push(
      sql`exists(${db
        .select({ n: sql`1` })
        .from(entityAliases)
        .where(
          and(
            eq(entityAliases.entityId, entities.id),
            ilike(entityAliases.name, input.name),
          ),
        )})`,
    );
  }

  if (input.country) {
    let countryId: number | null = null;
    if (Number.isFinite(+input.country)) {
      countryId = Number(input.country);
      where.push(eq(entities.countryId, countryId));
    } else {
      const [result] = await db
        .select({ id: countries.id })
        .from(countries)
        .where(eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()))
        .limit(1);
      if (!result) {
        badRequest("Invalid country.");
      }
      countryId = result.id;
      where.push(eq(entities.countryId, countryId));
    }

    if (input.region && Number.isFinite(+input.region)) {
      where.push(eq(entities.regionId, Number(input.region)));
    } else if (input.region) {
      const [result] = await db
        .select({ id: regions.id })
        .from(regions)
        .where(
          and(
            eq(sql`LOWER(${regions.slug})`, input.region.toLowerCase()),
            eq(regions.countryId, countryId),
          ),
        )
        .limit(1);
      if (!result) {
        badRequest("Invalid region.");
      }
      where.push(eq(entities.regionId, result.id));
    }
  } else if (input.region && Number.isFinite(+input.region)) {
    where.push(eq(entities.regionId, Number(input.region)));
  } else if (input.region) {
    badRequest("Region requires country.");
  }

  let orderBy: SQL<unknown>;
  switch (input.sort) {
    case "rank":
      orderBy = query
        ? sql`GREATEST(
              ts_rank(${entities.searchVector}, ${textQuery}),
              ts_rank(${entities.searchVector}, ${prefixQuery}) * 0.5
            ) DESC`
        : desc(entities.totalTastings);
      break;
    case "name":
      orderBy = asc(entities.name);
      break;
    case "-name":
      orderBy = desc(entities.name);
      break;
    case "-created":
      orderBy = desc(entities.createdAt);
      break;
    case "created":
      orderBy = asc(entities.createdAt);
      break;
    case "bottles":
      orderBy = asc(entities.totalBottles);
      break;
    case "-bottles":
      orderBy = desc(entities.totalBottles);
      break;
    case "tastings":
      orderBy = asc(entities.totalTastings);
      break;
    case "-tastings":
    default:
      orderBy = desc(entities.totalTastings);
  }

  const results = await db
    .select()
    .from(entities)
    .where(and(...where))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(orderBy, asc(entities.id));

  return {
    results: await serialize(
      EntitySerializer,
      results.slice(0, limit),
      currentUser,
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}

export function listEntityKind(
  options: ListEntitiesOptions & { kind: EntityKind },
) {
  return listEntities(options);
}
