import { ENTITY_TYPE_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { CountryEnum } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

const DEFAULT_SORT = "-tastings";

const SORT_OPTIONS = [
  "name",
  "created",
  "tastings",
  "bottles",
  "-name",
  "-created",
  "-tastings",
  "-bottles",
] as const;

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        country: CountryEnum.nullish(),
        region: z.string().nullish(),
        type: z.enum(ENTITY_TYPE_LIST).nullish(),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        cursor: z.number().gte(1).default(1),
        limit: z.number().lte(100).default(100),
      })
      .default({
        query: "",
        sort: DEFAULT_SORT,
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { cursor, limit, query, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(
        or(
          ilike(entities.name, `%${query}%`),
          ilike(entities.name, `%The ${query}%`),
        ),
      );
    }
    if (input.type) {
      where.push(sql`${input.type} = ANY(${entities.type})`);
    }
    if (input.country) {
      where.push(ilike(entities.country, input.country));
    }
    if (input.region) {
      where.push(ilike(entities.region, input.region));
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
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
      .select({
        ...getTableColumns(entities),
        // TODO: type this
        location: sql`ST_AsGeoJSON(${entities.location}) as location`,
      })
      .from(entities)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        EntitySerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
