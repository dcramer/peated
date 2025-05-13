import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { flightBottles, flights } from "@peated/server/db/schema";
import { requireAuth } from "@peated/server/orpc/middleware";
import { FlightInputSchema, FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

const InputSchema = FlightInputSchema.partial().extend({
  id: z.string(),
});

export default procedure
  .route({ method: "PATCH", path: "/flights/:id" })
  .use(requireAuth)
  .input(InputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context }) {
    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, input.id));

    if (!flight) {
      throw new ORPCError("NOT_FOUND", {
        message: "Flight not found.",
      });
    }

    if (flight.createdById !== context.user.id && !context.user.mod) {
      throw new ORPCError("FORBIDDEN", {
        message: "Cannot update another user's flight.",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.name && input.name !== flight.name) {
      data.name = input.name;
    }
    if (
      input.description !== undefined &&
      input.description !== flight.description
    ) {
      data.description = input.description;
    }
    if (input.public !== undefined && input.public !== flight.public) {
      data.public = input.public;
    }

    if (Object.values(data).length === 0 && !input.bottles) {
      return await serialize(FlightSerializer, flight, context.user);
    }

    const newFlight = await db.transaction(async (tx) => {
      const [newFlight] = Object.values(data).length
        ? await tx
            .update(flights)
            .set(data)
            .where(eq(flights.id, flight.id))
            .returning()
        : [flight];
      if (!newFlight) return;

      if (input.bottles) {
        await tx
          .delete(flightBottles)
          .where(
            and(
              eq(flightBottles.flightId, flight.id),
              notInArray(flightBottles.bottleId, input.bottles),
            ),
          );

        for (const bottle of input.bottles) {
          await tx
            .insert(flightBottles)
            .values({
              flightId: flight.id,
              bottleId: bottle,
            })
            .onConflictDoNothing();
        }
      }

      return newFlight;
    });

    if (!newFlight) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update flight.",
      });
    }

    return await serialize(FlightSerializer, newFlight, context.user);
  });
