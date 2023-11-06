import { PaginatedSchema, StoreSchema } from "@peated/server/schemas";
import type { SQL } from "drizzle-orm";
import { and, asc, ilike } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { db } from "@peated/server/db";
import { stores } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StoreSerializer } from "@peated/server/serializers/store";
import { buildPageLink } from "../lib/paging";

export default {
  method: "GET",
  url: "/stores",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        sort: { type: "string" },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(StoreSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (query) {
      where.push(ilike(stores.name, `%${query}%`));
    }

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      default:
        orderBy = asc(stores.name);
        break;
    }

    const results = await db
      .select()
      .from(stores)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    res.send({
      results: await serialize(
        StoreSerializer,
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
      query?: string;
      page?: number;
      sort?: "name";
    };
  }
>;
