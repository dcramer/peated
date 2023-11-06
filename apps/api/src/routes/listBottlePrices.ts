import { PaginatedSchema, StorePriceSchema } from "@peated/core/schemas";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { db } from "@peated/core/db";
import { bottles, storePrices, stores } from "@peated/core/db/schema";
import { serialize } from "@peated/core/serializers";
import { StorePriceWithStoreSerializer } from "@peated/core/serializers/storePrice";

export default {
  method: "GET",
  url: "/bottles/:bottleId/prices",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(StorePriceSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId));

    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const results = await db
      .select({
        ...getTableColumns(storePrices),
        store: stores,
      })
      .from(storePrices)
      .innerJoin(stores, eq(storePrices.storeId, stores.id))
      .where(
        and(
          eq(storePrices.bottleId, bottle.id),
          sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
        ),
      );

    res.send({
      results: await serialize(
        StorePriceWithStoreSerializer,
        results,
        req.user,
      ),
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
  }
>;
