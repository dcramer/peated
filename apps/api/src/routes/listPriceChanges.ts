import type { SQL } from "drizzle-orm";
import { and, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "../db";
import {
  bottles,
  storePriceHistories,
  storePrices,
  stores,
} from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { PriceChangeSerializer } from "../lib/serializers/storePrice";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "GET",
  url: "/priceChanges",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
      },
    },
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: SQL[] = [
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
    ];
    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const previous = db
      .select({
        ...getTableColumns(storePriceHistories),
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(
        and(
          sql`${storePrices.price} != ${storePriceHistories.price}`,
          sql`${storePriceHistories.date} < DATE(${storePrices.updatedAt})`,
          sql`${storePriceHistories.date} > NOW() - interval '1 week'`,
        ),
      )
      .orderBy(desc(storePriceHistories.date))
      .limit(1)
      .as("previous");

    const results = await db
      .select({
        ...getTableColumns(storePrices),
        store: stores,
        bottle: bottles,
        // XXX(dcramer): Drizzle doesnt seem to handle typing on the subquery select correctly
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        previous,
      })
      .from(storePrices)
      .innerJoin(bottles, eq(bottles.id, storePrices.bottleId))
      .innerJoin(stores, eq(stores.id, storePrices.storeId))
      .innerJoin(previous, eq(previous.priceId, storePrices.id))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(sql`ABS(${previous.price} - ${storePrices.price}) DESC`);

    res.send({
      // XXX(dcramer): Drizzle doesnt seem to handle typing on the subquery select correctly
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      results: await serialize(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        PriceChangeSerializer,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        results.slice(0, limit),
        req.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        next:
          results.length > limit
            ? buildPageLink(req.routeOptions.url, req.query, page + 1)
            : null,
        prev:
          page > 1
            ? buildPageLink(req.routeOptions.url, req.query, page - 1)
            : null,
      },
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      page?: number;
      query?: string;
    };
  }
>;
