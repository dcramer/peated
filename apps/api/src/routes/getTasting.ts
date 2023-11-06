import { db } from "@peated/core/db";
import { tastings } from "@peated/core/db/schema";
import { TastingSchema } from "@peated/core/schemas";
import { serialize } from "@peated/core/serializers";
import { TastingSerializer } from "@peated/core/serializers/tasting";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

export default {
  method: "GET",
  url: "/tastings/:tastingId",
  schema: {
    params: {
      type: "object",
      required: ["tastingId"],
      properties: {
        tastingId: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(TastingSchema),
    },
  },
  handler: async (req, res) => {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, req.params.tastingId));

    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    res.send(await serialize(TastingSerializer, tasting, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      tastingId: number;
    };
  }
>;
