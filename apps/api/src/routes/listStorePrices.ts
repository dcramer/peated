import type { SQL} from "drizzle-orm";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "../db";
import { storePrices, stores } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { StorePriceSerializer } from "../lib/serializers/storePrice";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "GET",
  url: "/stores/:storeId/prices",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
      },
    },
    params: {
      type: "object",
      required: ["storeId"],
      properties: {
        userId: { type: "number" },
      },
    },
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, req.params.storeId),
    });

    if (!store) {
      return res.status(404).send({ error: "Not found" });
    }

    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: SQL[] = [
      eq(storePrices.storeId, store.id),
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
    ];
    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(storePrices)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(storePrices.name));

    res.send({
      results: await serialize(
        StorePriceSerializer,
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
    Params: {
      storeId: number;
    };
    Querystring: {
      page?: number;
      query?: string;
    };
  }
>;
