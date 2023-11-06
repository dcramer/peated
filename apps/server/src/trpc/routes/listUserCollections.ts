import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { CollectionSchema, PaginatedSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { and, asc, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { getUserFromId, profileVisible } from "../lib/api";
import { buildPageLink } from "../lib/paging";

export default {
  method: "GET",
  url: "/users/:userId/collections",
  schema: {
    params: {
      type: "object",
      properties: {
        userId: {
          anyOf: [{ type: "number" }, { type: "string" }, { const: "me" }],
        },
      },
    },
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        bottle: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(CollectionSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const user = await getUserFromId(db, req.params.userId, req.user);
    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (!(await profileVisible(db, user, req.user))) {
      return res.status(400).send({ error: "User's profile is private" });
    }

    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const where = [];
    if (req.query.bottle) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${collectionBottles} WHERE ${collectionBottles.bottleId} = ${req.query.bottle} AND ${collectionBottles.collectionId} = ${collections.id})`,
      );
    }

    const results = await db
      .select()
      .from(collections)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(collections.name));

    res.send({
      results: await serialize(
        CollectionSerializer,
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
    Params: {
      userId: number | string | "me";
    };
    Querystring: {
      bottle: number;
      page?: number;
    };
  }
>;
