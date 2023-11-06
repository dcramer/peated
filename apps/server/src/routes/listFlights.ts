import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { FlightSchema, PaginatedSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { buildPageLink } from "../lib/paging";

const SORT_OPTIONS = ["name", "-name"] as const;

export default {
  method: "GET",
  url: "/flights",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        filter: { type: "string", enum: ["public", "private", "none"] },
        sort: { type: "string", enum: SORT_OPTIONS },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(FlightSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(ilike(flights.name, `%${query}%`));
    }

    if (req.user?.mod && req.query.filter === "none") {
      // do nothing
    } else {
      if (req.user) {
        where.push(
          or(eq(flights.public, true), eq(flights.createdById, req.user.id)),
        );
      } else {
        where.push(eq(flights.public, true));
      }

      if (req.query.filter === "public") {
        where.push(eq(flights.public, true));
      } else if (req.query.filter === "private") {
        where.push(eq(flights.public, false));
      }
    }

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      case "name":
        orderBy = asc(flights.name);
        break;
      case "-name":
        orderBy = desc(flights.name);
        break;
      default:
        orderBy = asc(flights.name);
    }

    const results = await db
      .select()
      .from(flights)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    res.send({
      results: await serialize(
        FlightSerializer,
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
      filter?: "public" | "private" | "none";
      page?: number;
      sort?: (typeof SORT_OPTIONS)[number];
    };
  }
>;
