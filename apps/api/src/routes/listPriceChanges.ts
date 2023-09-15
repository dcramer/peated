import type { SQL } from "drizzle-orm";
import { and, eq, ilike, isNotNull, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import {
  BottlePriceChangeSchema,
  PaginatedSchema,
} from "@peated/shared/schemas";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { storePriceHistories, storePrices } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { BottlePriceChangeSerializer } from "../lib/serializers/storePrice";

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
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(BottlePriceChangeSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const minChange = 500; // $5

    const where: SQL[] = [
      isNotNull(storePrices.bottleId),
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
      sql`${storePriceHistories.date} < DATE(${storePrices.updatedAt})`,
      sql`${storePriceHistories.date} > NOW() - interval '4 week'`,
    ];
    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const results = await db
      .select({
        id: sql<number>`${storePrices.bottleId}`,
        price: sql`AVG(${storePrices.price})`,
        previousPrice: sql`AVG(${storePriceHistories.price})`,
      })
      .from(storePrices)
      .innerJoin(
        storePriceHistories,
        eq(storePriceHistories.priceId, storePrices.id),
      )
      .where(and(...where))
      .groupBy(storePrices.bottleId)
      .having(
        sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) > ${minChange}`,
      )
      .orderBy(
        sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) DESC`,
      )
      .limit(limit + 1)
      .offset(offset);

    res.send({
      results: await serialize(
        BottlePriceChangeSerializer,
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
