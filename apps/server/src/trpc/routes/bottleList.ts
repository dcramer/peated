import { CATEGORY_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  flightBottles,
  flights,
  tastings,
} from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

const DEFAULT_SORT = "-tastings";

const SORT_OPTIONS = [
  "name",
  "age",
  "rating",
  "tastings",
  "-name",
  "-age",
  "-rating",
  "-tastings",
] as const;

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        brand: z.number().nullish(),
        distiller: z.number().nullish(),
        bottler: z.number().nullish(),
        entity: z.number().nullish(),
        tag: z.string().nullish(),
        flight: z.string().nullish(),
        category: z.enum(CATEGORY_LIST).nullish(),
        age: z.number().nullish(),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(25),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
        sort: DEFAULT_SORT,
      }),
  )
  .query(async function ({ input: { query, cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];

    if (query) {
      const likeQuery = `%${query}%`;
      const otherLikeQuery = `%The ${query}%`;
      where.push(
        or(
          ilike(bottles.fullName, likeQuery),
          ilike(bottles.fullName, otherLikeQuery),
          sql`EXISTS(
            SELECT 1
            FROM ${entities} e
            JOIN ${bottlesToDistillers} b
            ON e.id = b.distiller_id AND b.bottle_id = ${bottles.id}
            WHERE e.name ILIKE ${likeQuery}
          )`,
          // lol welcome to search
          sql`EXISTS(
            SELECT 1
            FROM ${entities} e
            WHERE e.id = ${bottles.brandId}
              AND (
                e.name ILIKE ${likeQuery}
                OR e.name ILIKE ${otherLikeQuery}
              )
          )`,
        ),
      );
    }
    if (input.brand) {
      where.push(eq(bottles.brandId, input.brand));
    }
    if (input.distiller) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${input.distiller} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
      );
    }
    if (input.bottler) {
      where.push(eq(bottles.bottlerId, input.bottler));
    }
    if (input.entity) {
      where.push(
        or(
          eq(bottles.brandId, input.entity),
          eq(bottles.bottlerId, input.entity),
          sql`EXISTS(SELECT 1 FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${input.entity} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
        ),
      );
    }
    if (input.category) {
      where.push(eq(bottles.category, input.category));
    }
    if (input.age) {
      where.push(eq(bottles.statedAge, input.age));
    }
    if (input.tag) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${tastings} WHERE ${input.tag} = ANY(${tastings.tags}) AND ${tastings.bottleId} = ${bottles.id})`,
      );
    }
    if (input.flight) {
      const [flight] = await db
        .select()
        .from(flights)
        .where(eq(flights.publicId, input.flight));
      if (!flight) {
        return {
          results: [],
          rel: {
            nextCursor: null,
            prevCursor: null,
          },
        };
      }
      where.push(
        sql`EXISTS(SELECT FROM ${flightBottles} WHERE ${flightBottles.flightId} = ${flight.id} AND ${flightBottles.bottleId} = ${bottles.id})`,
      );
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      case "name":
        orderBy = asc(bottles.fullName);
        break;
      case "-name":
        orderBy = desc(bottles.fullName);
        break;
      case "age":
        orderBy = asc(bottles.statedAge);
        break;
      case "-age":
        orderBy = desc(bottles.statedAge);
        break;
      case "tastings":
        orderBy = asc(bottles.totalTastings);
        break;
      case "rating":
        orderBy = sql`${bottles.avgRating} ASC NULLS LAST`;
        break;
      case "-rating":
        orderBy = sql`${bottles.avgRating} DESC NULLS LAST`;
        break;
      case "-tastings":
      default:
        orderBy = desc(bottles.totalTastings);
    }

    const results = await db
      .select({ bottles })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        BottleSerializer,
        results.slice(0, limit).map((r) => r.bottles),
        ctx.user,
        ["description", "tastingNotes"],
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
