import { db } from "@peated/core/db";
import { flights } from "@peated/core/db/schema";
import { FlightSchema } from "@peated/core/schemas";
import { serialize } from "@peated/core/serializers";
import { FlightSerializer } from "@peated/core/serializers/flight";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

export default {
  method: "GET",
  url: "/flights/:flightId",
  schema: {
    params: {
      type: "object",
      required: ["flightId"],
      properties: {
        flightId: { type: "string" },
      },
    },
    response: {
      200: zodToJsonSchema(FlightSchema),
    },
  },
  handler: async (req, res) => {
    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, req.params.flightId));
    if (!flight) {
      return res.status(404).send({ error: "Not found" });
    }

    res.send(await serialize(FlightSerializer, flight, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      flightId: string;
    };
  }
>;
