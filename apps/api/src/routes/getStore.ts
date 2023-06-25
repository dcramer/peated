import { StoreSchema } from "@peated/shared/schemas";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

import { db } from "../db";
import { stores } from "../db/schema";
import { serialize } from "../lib/serializers";
import { StoreSerializer } from "../lib/serializers/store";

export default {
  method: "GET",
  url: "/stores/:storeId",
  schema: {
    params: {
      type: "object",
      required: ["storeId"],
      properties: {
        storeId: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(StoreSchema),
    },
  },
  handler: async (req, res) => {
    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, req.params.storeId));
    if (!store) {
      return res.status(404).send({ error: "Not found" });
    }
    res.send(await serialize(StoreSerializer, store, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      storeId: number;
    };
  }
>;
