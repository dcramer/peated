import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { FlightInputSchema, FlightSchema } from "@peated/core/schemas";

import { db } from "@peated/core/db";
import type { NewFlight } from "@peated/core/db/schema";
import { flightBottles, flights } from "@peated/core/db/schema";
import { serialize } from "@peated/core/serializers";
import { FlightSerializer } from "@peated/core/serializers/flight";
import { generatePublicId } from "~/lib/publicId";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/flights",
  schema: {
    body: zodToJsonSchema(FlightInputSchema),
    response: {
      201: zodToJsonSchema(FlightSchema),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const body = req.body;
    const data: NewFlight = {
      ...body,
      publicId: generatePublicId(),
      createdById: req.user.id,
    };

    const user = req.user;
    const flight = await db.transaction(async (tx) => {
      const [flight] = await tx.insert(flights).values(data).returning();

      if (body.bottles) {
        for (const bottle of body.bottles) {
          await tx.insert(flightBottles).values({
            flightId: flight.id,
            bottleId: bottle,
          });
        }
      }

      return flight;
    });

    if (!flight) {
      return res.status(500).send({ error: "Failed to create flight" });
    }

    res.status(201).send(await serialize(FlightSerializer, flight, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: z.infer<typeof FlightInputSchema>;
  }
>;
