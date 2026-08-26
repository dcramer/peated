import { implement } from "@orpc/server";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
import sentryMiddleware from "@peated/orpc/server/middleware";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
  entityAliases,
  regions,
} from "@peated/server/db/schema";
import {
  plainTextSearchQuery,
  prefixTextSearchQuery,
} from "@peated/server/lib/search";
import type { Context } from "@peated/server/orpc/context";
import entityListContract from "@peated/server/orpc/contracts/entities/list";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

export default implement(entityListContract)
  .$context<Context>()
  .use(sentryMiddleware())
  .handler(async function ({
    input: { query, cursor, limit, ...input },
    context,
    errors,
  }) {
    const offset = (cursor - 1) * limit;
    const textQuery = plainTextSearchQuery(query);
    const prefixQuery = prefixTextSearchQuery(query);

    const where: (SQL<unknown> | undefined)[] = [];
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
          throw errors.BAD_REQUEST({
            message: "Invalid country.",
          });
        }
        countryId = result.id;
        where.push(eq(entities.countryId, countryId));
      }

      if (!countryId) {
        throw errors.BAD_REQUEST({
          message: "Invalid country.",
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
          throw errors.BAD_REQUEST({
            message: "Invalid region.",
          });
        }
        where.push(eq(entities.regionId, result.id));
      }
    } else if (input.region && Number.isFinite(+input.region)) {
      where.push(eq(entities.regionId, Number(input.region)));
    } else if (input.region) {
      throw errors.BAD_REQUEST({
        message: "Region requires country.",
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
          orderBy = sql`GREATEST(
            ts_rank(${entities.searchVector}, ${textQuery}),
            ts_rank(${entities.searchVector}, ${prefixQuery}) * 0.5
          ) DESC`;
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
      .orderBy(...orderClauses, asc(entities.id));

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
