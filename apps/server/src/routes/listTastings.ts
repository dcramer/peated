import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  follows,
  tastings,
  users,
} from "@peated/server/db/schema";
import { PaginatedSchema, TastingSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { buildPageLink } from "../lib/paging";

export default {
  method: "GET",
  url: "/tastings",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        limit: { type: "number", minimum: 1, maximum: 100 },
        bottle: { type: "number" },
        entity: { type: "number" },
        user: { oneOf: [{ type: "number" }, { const: "me" }] },
        filter: { type: "string", enum: ["global", "friends", "local"] },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(TastingSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = req.query.limit || 25;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (req.query.bottle) {
      where.push(eq(tastings.bottleId, req.query.bottle));
    }

    if (req.query.entity) {
      where.push(
        sql`EXISTS(
          SELECT FROM ${bottles}
          WHERE (${bottles.brandId} = ${req.query.entity}
             OR ${bottles.bottlerId} = ${req.query.entity}
             OR EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                AND ${bottlesToDistillers.distillerId} = ${req.query.entity}
             )) AND ${bottles.id} = ${tastings.bottleId}
          )`,
      );
    }

    if (req.query.user) {
      if (req.query.user === "me") {
        if (!req.user) return res.status(401).send({ error: "Unauthorized" });

        where.push(eq(tastings.createdById, req.user.id));
      } else {
        where.push(eq(tastings.createdById, req.query.user));
      }
    }

    const limitPrivate = req.query.filter !== "friends";
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

    if (limitPrivate) {
      where.push(
        or(
          eq(users.private, false),
          ...(req.user
            ? [
                eq(tastings.createdById, req.user.id),
                sql`${tastings.createdById} IN (
                  SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${req.user.id} AND ${follows.status} = 'following'
                )`,
              ]
            : []),
        ),
      );
    }

    const results = await db
      .select({ tastings })
      .from(tastings)
      .innerJoin(users, eq(users.id, tastings.createdById))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(tastings.createdAt));

    res.send({
      results: await serialize(
        TastingSerializer,
        results.map((t) => t.tastings).slice(0, limit),
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
      limit?: number;
      page?: number;
      bottle?: number;
      entity?: number;
      user?: number | "me";
      filter?: "global" | "friends" | "local";
    };
  }
>;
