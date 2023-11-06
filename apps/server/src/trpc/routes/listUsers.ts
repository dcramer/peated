import type { SQL } from "drizzle-orm";
import { and, asc, ilike, or } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";

import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { PaginatedSchema, UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import zodToJsonSchema from "zod-to-json-schema";
import { buildPageLink } from "../lib/paging";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/users",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(UserSchema),
        }),
      ),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(
        or(ilike(users.displayName, `%${query}%`), ilike(users.email, query)),
      );
    } else if (!req.user.admin) {
      return res.send({
        results: [],
        rel: {
          nextPage: null,
          next: null,
          prevPage: null,
          prev: null,
        },
      });
    }

    const results = await db
      .select()
      .from(users)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(users.displayName));

    res.send({
      results: await serialize(
        UserSerializer,
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
    };
  }
>;
