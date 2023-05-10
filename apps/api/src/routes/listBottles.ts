import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { buildPageLink } from "../lib/paging";
import {
  Entity,
  bottles,
  bottlesToDistillers,
  entities,
  tastings,
} from "../db/schema";
import { db } from "../db";
import { SQL, and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";

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
      where.push(ilike(bottles.name, `%${query}%`));
    }
    if (req.query.brand) {
      where.push(eq(bottles.brandId, req.query.brand));
    }
    if (req.query.distiller) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${req.query.distiller} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`
      );
    }

    const select: any = {};
    let orderBy: SQL<unknown>;
    switch (req.query.sort) {
      case "name":
        orderBy = asc(bottles.name);
        break;
      default:
        // TODO: materialize // also this query pattern isnt supported yet
        // select.totalTastings = db
        //   .select({
        //     count: sql<number>`COUNT(*)`,
        //   })
        //   .from(tastings)
        //   .where(eq(tastings.bottleId, bottles.id));
        // orderBy = desc(select.totalTastings);
        orderBy = sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${tastings.bottleId} = ${bottles.id}) DESC`;
    }

    const results = await db
      .select({
        bottle: bottles,
        brand: entities,
        ...select,
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
            eq(bottlesToDistillers.distillerId, entities.id)
          )
          .where(
            inArray(
              bottlesToDistillers.bottleId,
              results.map(({ bottle: b }) => b.id)
            )
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
      results: results.slice(0, limit).map(({ bottle, brand }) => ({
        ...bottle,
        brand,
        distillers: distillersByBottleId[bottle.id],
      })),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        next:
          results.length > limit
            ? buildPageLink(req.routeOptions.url, req.query, page + 1)
            : null,
        prevPage: page > 1 ? page - 1 : null,
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
      sort?: "name";
    };
  }
>;
