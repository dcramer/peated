import { SQL, and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { Entity, bottles, bottlesToDistillers, entities } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serializeBottle } from "../lib/serializers/bottle";

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
      },
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
          ilike(entities.name, `%${query}%`),
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

    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      case "name":
        orderBy = asc(bottles.name);
        break;
      default:
        orderBy = desc(bottles.totalTastings);
    }

    const results = await db
      .select({
        bottle: bottles,
        brand: entities,
      })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    const distillers = results.length
      ? await db
          .select({
            bottleId: bottlesToDistillers.bottleId,
            distiller: entities,
          })
          .from(entities)
          .innerJoin(
            bottlesToDistillers,
            eq(bottlesToDistillers.distillerId, entities.id),
          )
          .where(
            inArray(
              bottlesToDistillers.bottleId,
              results.map(({ bottle: b }) => b.id),
            ),
          )
      : [];
    const distillersByBottleId: {
      [bottleId: number]: Entity[];
    } = {};
    distillers.forEach((d) => {
      if (!distillersByBottleId[d.bottleId])
        distillersByBottleId[d.bottleId] = [d.distiller];
      else distillersByBottleId[d.bottleId].push(d.distiller);
    });

    res.send({
      results: results.slice(0, limit).map(({ bottle, brand }) =>
        serializeBottle(
          {
            ...bottle,
            brand,
            distillers: distillersByBottleId[bottle.id],
          },
          req.user,
        ),
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
      sort?: "name";
    };
  }
>;
