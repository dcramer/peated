import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { buildPageLink } from "../lib/paging";
import { bottles, entities, tastings } from "../db/schema";
import { db } from "../lib/db";
import { SQL, and, asc, desc, eq, ilike, sql } from "drizzle-orm";

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
        type: { type: "string", enum: ["distiller", "brand"] },
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
        // TODO: materialize
        orderBy = sql<number>`(SELECT COUNT(*) FROM ${tastings} JOIN ${bottles} ON ${tastings.bottleId} = ${bottles.id} WHERE ${bottles.brandId} = ${entities.id}) DESC`;
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
      type?: "brand" | "distiller";
    };
  }
>;
