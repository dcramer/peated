import { SQL, and, desc, eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import {
  Entity,
  bottles,
  bottlesToDistillers,
  editions,
  entities,
  follows,
  tastings,
  toasts,
  users,
} from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serializeTasting } from "../lib/serializers/tasting";
import { injectAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/tastings",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        bottle: { type: "number" },
        user: { type: "number" },
        filter: { type: "string", enum: ["global", "friends", "local"] },
      },
    },
  },
  preValidation: [injectAuth],
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (req.query.bottle) {
      where.push(eq(tastings.bottleId, req.query.bottle));
    }
    if (req.query.user) {
      where.push(eq(tastings.createdById, req.query.user));
    }
    if (req.query.filter) {
      if (req.query.filter === "friends") {
        if (!req.user) {
          return res.status(401).send({ error: "Not authenticated" });
        }
        where.push(
          sql`${tastings.createdById} IN (SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${req.user.id} AND ${follows.status} = 'following')`,
        );
      }
    }

    const results = await db
      .select({
        tasting: tastings,
        bottle: bottles,
        brand: entities,
        createdBy: users,
        edition: editions,
      })
      .from(tastings)
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .innerJoin(users, eq(tastings.createdById, users.id))
      .leftJoin(editions, eq(tastings.editionId, editions.id))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(tastings.createdAt));

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

    const userToastsList: number[] =
      req.user && results.length
        ? (
            await db
              .select({ tastingId: toasts.tastingId })
              .from(toasts)
              .where(
                and(
                  inArray(
                    toasts.tastingId,
                    results.map((t) => t.tasting.id),
                  ),
                  eq(toasts.createdById, req.user.id),
                ),
              )
          ).map((t) => t.tastingId)
        : [];

    res.send({
      results: results
        .slice(0, limit)
        .map(({ tasting, bottle, brand, createdBy, edition }) =>
          serializeTasting(
            {
              ...tasting,
              createdBy,
              edition,
              bottle: {
                ...bottle,
                brand,
                distillers: distillersByBottleId[bottle.id],
              },
              hasToasted: userToastsList.indexOf(tasting.id) !== -1,
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
      page?: number;
      bottle?: number;
      user?: number;
      filter?: "global" | "friends" | "local";
    };
  }
>;
