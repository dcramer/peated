import { PaginatedSchema, StorePriceSchema } from "@peated/shared/schemas";
import { eq, getTableColumns } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { db } from "../db";
import { bottles, storePrices, stores } from "../db/schema";
import { serialize } from "../lib/serializers";
import { StorePriceWithStoreSerializer } from "../lib/serializers/storePrice";

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
      .where(eq(storePrices.bottleId, bottle.id));

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
