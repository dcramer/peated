import { ENTITY_TYPE_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { EntityType } from "@peated/server/db/schema";
import { entities } from "@peated/server/db/schema";
import { EntitySchema, PaginatedSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, getTableColumns, ilike, or, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { buildPageLink } from "../lib/paging";

const SORT_OPTIONS = [
  "name",
  "created",
  "tastings",
  "bottles",
  "-name",
  "-created",
  "-tastings",
  "-bottles",
] as const;

export default {
  method: "GET",
  url: "/entities",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        sort: { type: "string", enum: SORT_OPTIONS },
        country: { type: "string" },
        region: { type: "string" },
        type: { type: "string", enum: ENTITY_TYPE_LIST },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(EntitySchema),
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
      where.push(
        or(
          ilike(entities.name, `%${query}%`),
          ilike(entities.name, `%The ${query}%`),
        ),
      );
    }
    if (req.query.type) {
      where.push(sql`${req.query.type} = ANY(${entities.type})`);
    }
    if (req.query.country) {
      where.push(ilike(entities.country, req.query.country));
    }
    if (req.query.region) {
      where.push(ilike(entities.region, req.query.region));
    }

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
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

    const results = await db
      .select({
        ...getTableColumns(entities),
        location: sql`ST_AsGeoJSON(${entities.location}) as location`,
      })
      .from(entities)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    res.send({
      results: await serialize(
        EntitySerializer,
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
      sort?: (typeof SORT_OPTIONS)[number];
      type?: EntityType;
      country?: string;
      region?: string;
    };
  }
>;
