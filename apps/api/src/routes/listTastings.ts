import { PaginatedSchema, TastingSchema } from "@peated/shared/schemas";
import { SQL, and, desc, eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { follows, tastings } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { TastingSerializer } from "../lib/serializers/tasting";
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
      where.push(
        eq(
          tastings.createdById,
          req.query.user === "me" ? req.user.id : req.query.user,
        ),
      );
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
      .select()
      .from(tastings)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(tastings.createdAt));

    res.send({
      results: await serialize(
        TastingSerializer,
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
      page?: number;
      bottle?: number;
      user?: number | "me";
      filter?: "global" | "friends" | "local";
    };
  }
>;
