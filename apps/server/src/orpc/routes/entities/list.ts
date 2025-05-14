import { ORPCError } from "@orpc/server";
import { ENTITY_TYPE_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
  entityAliases,
  regions,
} from "@peated/server/db/schema";
import { parseDetailsFromName } from "@peated/server/lib/smws";
import { procedure } from "@peated/server/orpc";
import { EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_SORT = "rank";

const SORT_OPTIONS = [
  "rank",
  "name",
  "created",
  "tastings",
  "bottles",
  "-name",
  "-created",
  "-tastings",
  "-bottles",
] as const;

const InputSchema = z
  .object({
    query: z.string().default(""),
    name: z.string().nullish(),
    country: z.coerce.string().nullish().describe("Country slug or id"),
    region: z.coerce.string().nullish().describe("Region slug or id"),
    type: z.enum(ENTITY_TYPE_LIST).nullish(),
    bottler: z.number().nullish(),
    searchContext: z
      .object({
        type: z.enum(ENTITY_TYPE_LIST).nullish(),
        brand: z.number().nullish(),
        bottleName: z.string().nullish(),
      })
      .nullish(),
    sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().lte(500).default(100),
  })
  .default({
    query: "",
    sort: DEFAULT_SORT,
    cursor: 1,
    limit: 100,
  });

const OutputSchema = z.object({
  results: z.array(EntitySchema),
  rel: z.object({
    nextCursor: z.number().nullable(),
    prevCursor: z.number().nullable(),
  }),
});

export default procedure
  .route({ method: "GET", path: "/entities" })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({
    input: { query, cursor, limit, ...input },
    context,
  }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(
        sql`${entities.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
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
    if (input.type) {
      where.push(sql`${input.type} = ANY(${entities.type})`);
    }

    if (input.country) {
      let countryId: number | null = null;
      if (Number.isFinite(+input.country)) {
        countryId = Number(input.country);
        where.push(eq(entities.countryId, countryId));
      } else if (input.country) {
        const [result] = await db
          .select({ id: countries.id })
          .from(countries)
          .where(eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()))
          .limit(1);
        if (!result) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid country",
          });
        }
        countryId = result.id;
        where.push(eq(entities.countryId, countryId));
      }

      if (!countryId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid country",
        });
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
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid region",
          });
        }
        where.push(eq(entities.regionId, result.id));
      }
    } else if (input.region && Number.isFinite(+input.region)) {
      where.push(eq(entities.regionId, Number(input.region)));
    } else if (input.region) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Region requires country",
      });
    }

    if (input.bottler) {
      where.push(sql`${entities.id} IN (
          SELECT DISTINCT ${bottlesToDistillers.distillerId}
            FROM ${bottles}
            JOIN ${bottlesToDistillers}
              ON ${bottlesToDistillers.bottleId} = ${bottles.id}
           WHERE ${bottles.bottlerId} = ${input.bottler}
        )`);
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      case "rank":
        if (query) {
          orderBy = sql`ts_rank(${entities.searchVector}, websearch_to_tsquery('english', ${query})) DESC`;
        } else {
          orderBy = desc(entities.totalTastings);
        }
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

    const { searchContext } = input;

    // SWMS we can bias distiller selection
    let nameBias: string | null = null;
    // TODO: we should restrict this to SMWS
    if (
      searchContext?.brand &&
      searchContext?.bottleName &&
      searchContext?.type === "distiller"
    ) {
      const details = parseDetailsFromName(searchContext.bottleName);
      if (details?.distiller) {
        nameBias = details.distiller.toLowerCase();
      }
    }

    if (nameBias) {
      where.push(
        or(
          ilike(entities.name, nameBias),
          sql`exists(${db
            .select({ n: sql`1` })
            .from(entityAliases)
            .where(
              and(
                eq(entityAliases.entityId, entities.id),
                ilike(entityAliases.name, nameBias),
              ),
            )})`,
        ),
      );
    }

    const cases = [];
    if (nameBias) {
      cases.push(sql`WHEN ${entities.name} ILIKE ${nameBias} THEN 100`);
    }
    if (searchContext?.brand && searchContext?.type === "bottler") {
      cases.push(
        sql`WHEN ${entities.id} IN (SELECT ${bottles.bottlerId} FROM ${bottles} WHERE ${bottles.brandId} = ${searchContext.brand}) THEN 10`,
      );
    } else if (searchContext?.brand && searchContext?.type === "distiller") {
      cases.push(
        sql`WHEN ${entities.id} IN (SELECT ${bottlesToDistillers.distillerId} FROM ${bottlesToDistillers} JOIN ${bottles} ON ${bottlesToDistillers.bottleId} = ${bottles.id} WHERE ${bottles.brandId} = ${searchContext.brand}) THEN 10`,
      );
    }
    if (searchContext?.type) {
      cases.push(
        sql`WHEN ${searchContext.type} = ANY(${entities.type}) THEN 1`,
      );
    }

    const orderClauses = [orderBy];
    if (cases.length) {
      const weightClause = sql`CASE ${sql.join(cases, sql` `)} ELSE 0 END DESC`;
      orderClauses.unshift(weightClause);
    }

    let results = await db
      .select()
      .from(entities)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(...orderClauses);

    return {
      results: await serialize(
        EntitySerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
