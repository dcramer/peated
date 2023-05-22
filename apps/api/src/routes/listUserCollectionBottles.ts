import {
  CollectionBottleSchema,
  PaginatedSchema,
} from "@peated/shared/schemas";
import { SQL, and, asc, eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db, first } from "../db";
import {
  Collection,
  bottles,
  collectionBottles,
  collections,
  entities,
} from "../db/schema";
import { getDefaultCollection } from "../lib/db";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { CollectionBottleSerializer } from "../lib/serializers/collectionBottle";
import { injectAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/users/:userId/collections/:collectionId/bottles",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
      },
    },
    params: {
      type: "object",
      properties: {
        userId: { anyOf: [{ type: "number" }, { const: "me" }] },
        collectionId: { anyOf: [{ type: "number" }, { const: "default" }] },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(CollectionBottleSchema),
        }),
      ),
    },
  },
  preHandler: [injectAuth],
  handler: async (req, res) => {
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;
    const collection =
      req.params.collectionId === "default"
        ? await getDefaultCollection(db, userId)
        : first<Collection>(
            await db
              .select()
              .from(collections)
              .where(
                and(
                  eq(collections.createdById, userId),
                  eq(collections.id, req.params.collectionId),
                ),
              ),
          );

    if (!collection) {
      return res.status(404).send({ error: "Not found" });
    }

    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(collectionBottles.collectionId, collection.id),
    ];

    const results = await db
      .select({ collectionBottles, bottles })
      .from(collectionBottles)
      .where(where ? and(...where) : undefined)
      .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(sql<string>`(${entities.name} || ' ' || ${bottles.name})`));

    res.send({
      results: await serialize(
        CollectionBottleSerializer,
        results.slice(0, limit).map(({ collectionBottles, bottles }) => ({
          ...collectionBottles,
          bottle: bottles,
        })),
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
      userId: number | "me";
      collectionId: number | "default";
    };
    Querystring: {
      query?: string;
      page?: number;
    };
  }
>;
