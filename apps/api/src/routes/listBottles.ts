import { BottleSchema, PaginatedSchema } from "@peated/shared/schemas";
import type { Category } from "@peated/shared/types";
import { CategoryValues } from "@peated/shared/types";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { bottles, bottlesToDistillers, entities, tastings } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";

export default {
  method: "GET",
  url: "/bottles",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        sort: { type: "string" },
        brand: { type: "number" },
        distiller: { type: "number" },
        bottler: { type: "number" },
        entity: { type: "number" },
        tag: { type: "string" },
        category: {
          type: "string",
          enum: CategoryValues,
        },
        age: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(BottleSchema),
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
      const likeQuery = `%${query}%`;
      where.push(
        or(
          ilike(bottles.name, likeQuery),
          ilike(bottles.series, likeQuery),
          sql`${bottles.series} || ' ' || ${bottles.name} ILIKE ${likeQuery}`,
          sql`${bottles.name} || ' ' || ${bottles.series} ILIKE ${likeQuery}`,
          sql`EXISTS(
            SELECT 1
            FROM ${entities} e
            JOIN ${bottlesToDistillers} b
            ON e.id = b.distiller_id AND b.bottle_id = ${bottles.id}
            WHERE e.name ILIKE ${likeQuery}
          )`,
          // lol welcome to search
          sql`EXISTS(
            SELECT 1
            FROM ${entities} e
            WHERE e.id = ${bottles.brandId}
              AND (
                e.name ILIKE ${likeQuery}
                OR e.name || ' ' || ${bottles.name} ILIKE ${likeQuery}
                OR e.name || ' ' || ${bottles.series} ILIKE ${likeQuery}
                OR e.name || ' ' || ${bottles.name} || ' ' || ${bottles.series} ILIKE ${likeQuery}
                OR e.name || ' ' || ${bottles.series} || ' ' || ${bottles.name} ILIKE ${likeQuery}
              )
          )`,
        ),
      );
    }
    if (req.query.brand) {
      where.push(eq(bottles.brandId, req.query.brand));
    }
    if (req.query.distiller) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${req.query.distiller} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
      );
    }
    if (req.query.bottler) {
      where.push(eq(bottles.bottlerId, req.query.bottler));
    }
    if (req.query.entity) {
      where.push(
        or(
          eq(bottles.brandId, req.query.entity),
          eq(bottles.bottlerId, req.query.entity),
          sql`EXISTS(SELECT 1 FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${req.query.entity} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
        ),
      );
    }
    if (req.query.category) {
      where.push(eq(bottles.category, req.query.category));
    }
    if (req.query.age) {
      where.push(eq(bottles.statedAge, req.query.age));
    }
    if (req.query.tag) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${tastings} WHERE ${req.query.tag} = ANY(${tastings.tags}) AND ${tastings.bottleId} = ${bottles.id})`,
      );
    }

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      case "name":
        orderBy = sql`${entities.name} || ${bottles.name} ASC`;
        break;
      default:
        orderBy = desc(bottles.totalTastings);
    }

    const results = await db
      .select({ bottles })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    res.send({
      results: await serialize(
        BottleSerializer,
        results.slice(0, limit).map((r) => r.bottles),
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
      brand?: number;
      distiller?: number;
      bottler?: number;
      entity?: number;
      category?: Category;
      age?: number;
      tag?: string;
      sort?: string;
    };
  }
>;
