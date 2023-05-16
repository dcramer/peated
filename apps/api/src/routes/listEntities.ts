import { SQL, and, asc, desc, ilike, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { EntityType, entities } from "../db/schema";
import { buildPageLink } from "../lib/paging";

export default {
  method: "GET",
  url: "/entities",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        sort: { type: "string" },
        type: { type: "string", enum: ["distiller", "brand", "bottler"] },
      },
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (query) {
      where.push(ilike(entities.name, `%${query}%`));
    }
    if (req.query.type) {
      where.push(sql`${req.query.type} = ANY(${entities.type})`);
    }

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      case "name":
        orderBy = asc(entities.name);
        break;
      default:
        orderBy = desc(entities.totalTastings);
    }

    const results = await db
      .select()
      .from(entities)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    res.send({
      results: results.slice(0, limit),
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
      type?: EntityType;
    };
  }
>;
