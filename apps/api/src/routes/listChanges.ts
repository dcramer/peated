import { ChangeSchema, PaginatedSchema } from "@peated/shared/schemas";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { changes } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { ChangeSerializer } from "../lib/serializers/change";

export default {
  method: "GET",
  url: "/changes",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        user: { anyOf: [{ type: "string" }, { const: "me" }] },
        type: { type: "string", enum: ["bottle", "entity"] },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(ChangeSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];

    if (req.query.type) {
      where.push(eq(changes.objectType, req.query.type));
    }
    if (req.query.user) {
      if (req.query.user === "me") {
        if (!req.user) return res.status(401).send({ error: "Unauthorized" });

        where.push(eq(changes.createdById, req.user.id));
      } else {
        where.push(eq(changes.createdById, req.query.user));
      }
    }

    const results = await db
      .select()
      .from(changes)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(changes.createdAt));

    res.send({
      results: await serialize(
        ChangeSerializer,
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
      type?: "bottle" | "entity";
      user?: number | "me";
    };
  }
>;
