import { BottleSchema, PaginatedSchema } from "@peated/shared/schemas";
import { SQL, and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import {
  bottles,
  bottlesToDistillers,
  collectionBottles,
  entities,
} from "../db/schema";
import { getDefaultCollection } from "../lib/db";
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
        entity: { type: "number" },
        user: { type: "number" },
        collection: { anyOf: [{ type: "number" }, { const: "default" }] },
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
      where.push(
        or(
          ilike(bottles.name, `%${query}%`),
          sql`EXISTS(
            SELECT 1
            FROM ${entities} e
            JOIN ${bottlesToDistillers} b
            ON e.id = b.distiller_id AND b.bottle_id = ${bottles.id}
            WHERE e.name ILIKE ${`%${query}%`}
          )`,
          sql`EXISTS(
            SELECT 1
            FROM ${entities} e
            WHERE e.id = ${bottles.brandId}
              AND e.name ILIKE ${`%${query}%`}
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
    if (req.query.entity) {
      where.push(
        or(
          eq(bottles.brandId, req.query.entity),
          sql`EXISTS(SELECT 1 FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${req.query.entity} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
        ),
      );
    }
    if (req.query.collection) {
      const userId = req.query.user || req.user?.id;
      if (req.query.collection === "default" && !userId) {
        return res.status(401).send({});
      }
      const collectionId =
        req.query.collection === "default"
          ? (await getDefaultCollection(db, userId)).id
          : req.query.collection;
      where.push(
        sql`EXISTS(SELECT 1 FROM ${collectionBottles} WHERE ${collectionBottles.bottleId} = ${bottles.id} AND ${collectionBottles.collectionId} = ${collectionId})`,
      );
    }

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      case "name":
        orderBy = asc(bottles.name);
        break;
      default:
        orderBy = desc(bottles.totalTastings);
    }

    const results = await db
      .select()
      .from(bottles)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    res.send({
      results: await serialize(
        BottleSerializer,
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
      brand?: number;
      distiller?: number;
      entity?: number;
      collection?: number | "default";
      user?: number;
      sort?: "name";
    };
  }
>;
