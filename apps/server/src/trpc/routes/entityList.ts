import { ENTITY_TYPE_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import { parseDetailsFromName } from "@peated/server/lib/smws";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { TRPCError } from "@trpc/server";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

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

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        name: z.string().nullish(),
        country: z.string().nullish(),
        region: z.string().nullish(),
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
        cursor: z.number().gte(1).default(1),
        limit: z.number().lte(500).default(100),
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
      const [result] = await db
        .select({ id: countries.id })
        .from(countries)
        .where(
          or(
            eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()),
            eq(sql`LOWER(${countries.name})`, input.country.toLowerCase()),
          ),
        )
        .limit(1);
      if (!result) {
        throw new TRPCError({
          message: "Invalid country",
          code: "BAD_REQUEST",
        });
      }
      where.push(eq(entities.countryId, result.id));
    }
    if (input.region) {
      where.push(ilike(entities.region, input.region));
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

    // TODO:
    // if (searchContext?.brand === "" && searchContext?.type === "bottler") {
    //   nameBias = "the scotch malt whisky society";
    // }

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
      // TODO: we could index this graph
      cases.push(
        sql`WHEN ${entities.id} IN (SELECT ${bottles.bottlerId} FROM ${bottles} WHERE ${bottles.brandId} = ${searchContext.brand}) THEN 10`,
      );
    } else if (searchContext?.brand && searchContext?.type === "distiller") {
      // TODO: we could index this graph
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
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
