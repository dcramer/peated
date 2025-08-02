import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Flight } from "@peated/server/db/schema";
import {
  bottles,
  bottlesToDistillers,
  entities,
  flightBottles,
  flights,
  tastings,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  BottleSchema,
  CaskTypeEnum,
  CursorSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_SORT = "-tastings";

const SORT_OPTIONS = [
  "rank",
  "brand",
  "created",
  "name",
  "age",
  "rating",
  "tastings",
  "-created",
  "-name",
  "-age",
  "-rating",
  "-tastings",
] as const;

export default procedure
  .route({
    method: "GET",
    path: "/bottles",
    summary: "List bottles",
    description:
      "Search and filter bottles with pagination support. Supports filtering by brand, distillery, category, age, and more",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottles",
    }),
  })
  .input(
    z.object({
      query: z.coerce.string().default(""),
      brand: z.coerce.number().nullish(),
      distiller: z.coerce.number().nullish(),
      bottler: z.coerce.number().nullish(),
      entity: z.coerce.number().nullish(),
      series: z.coerce.number().nullish(),
      tag: z.string().nullish(),
      flavorProfile: z.enum(FLAVOR_PROFILES).nullish(),
      flight: z.string().nullish(),
      category: z.enum(CATEGORY_LIST).nullish(),
      age: z.coerce.number().nullish(),
      caskType: CaskTypeEnum.nullish(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
    }),
  )
  .output(
    z.object({
      // TODO: variable output isnt great here
      results: z.array(BottleSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { query, cursor, limit, ...rest } = input;
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];

    if (query) {
      where.push(
        sql`${bottles.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
      );
    }
    if (rest.brand) {
      where.push(eq(bottles.brandId, rest.brand));
    }
    if (rest.distiller) {
      where.push(
        sql`EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${rest.distiller} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
      );
    }
    if (rest.bottler) {
      where.push(eq(bottles.bottlerId, rest.bottler));
    }
    if (rest.entity) {
      where.push(
        or(
          eq(bottles.brandId, rest.entity),
          eq(bottles.bottlerId, rest.entity),
          sql`EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${rest.entity} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
        ),
      );
    }
    if (rest.series) {
      where.push(eq(bottles.seriesId, rest.series));
    }
    if (rest.category) {
      where.push(eq(bottles.category, rest.category));
    }
    if (rest.flavorProfile) {
      where.push(eq(bottles.flavorProfile, rest.flavorProfile));
    }
    if (rest.age) {
      where.push(eq(bottles.statedAge, rest.age));
    }
    if (rest.caskType) {
      where.push(eq(bottles.caskType, rest.caskType));
    }
    if (rest.tag) {
      where.push(
        sql`EXISTS(SELECT FROM ${tastings} WHERE ${rest.tag} = ANY(${tastings.tags}) AND ${tastings.bottleId} = ${bottles.id})`,
      );
    }

    let flight: Flight | null = null;
    if (rest.flight) {
      [flight] = await db
        .select()
        .from(flights)
        .where(eq(flights.publicId, rest.flight));
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
    switch (rest.sort) {
      case "rank":
        if (query) {
          orderBy = sql`ts_rank(${bottles.searchVector}, websearch_to_tsquery('english', ${query})) DESC`;
        } else {
          orderBy = desc(bottles.totalTastings);
        }
        break;
      case "brand":
        if (!rest.entity) {
          throw errors.BAD_REQUEST({
            message: "Cannot sort by brand without entity filter.",
          });
        }
        orderBy = sql`${entities.name} ASC, ${bottles.name} ASC`;
        break;
      case "created":
        orderBy = asc(bottles.createdAt);
        break;
      case "-created":
        orderBy = desc(bottles.createdAt);
        break;
      case "name":
        orderBy = asc(bottles.fullName);
        break;
      case "-name":
        orderBy = desc(bottles.fullName);
        break;
      case "age":
        orderBy = sql`${bottles.statedAge} ASC NULLS FIRST`;
        break;
      case "-age":
        orderBy = sql`${bottles.statedAge} DESC NULLS LAST`;
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
        context.user,
        ["description", "tastingNotes"],
        {
          flight,
        },
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
