import { db } from "@peated/server/db";
import { flightBottles, flights } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { FlightInputSchema, FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";

const InputSchema = FlightInputSchema.partial().extend({
  flight: z.string(),
});

export default procedure
  .route({
    method: "PATCH",
    path: "/flights/{flight}",
    operationId: "updateFlight",
    summary: "Update flight",
    description:
      "Update flight information including name, description, and bottle list. Only the flight creator or moderator can update",
  })
  .use(requireAuth)
  .input(InputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const { flight: flightId, bottles: bottleIds, ...data } = input;

    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, flightId));

    if (!flight) {
      throw errors.NOT_FOUND({
        message: "Flight not found.",
      });
    }

    if (flight.createdById !== context.user.id && !context.user.mod) {
      throw errors.FORBIDDEN({
        message: "Cannot update another user's flight.",
      });
    }

    if (Object.values(data).length === 0 && !bottleIds) {
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

      if (bottleIds) {
        await tx
          .delete(flightBottles)
          .where(
            and(
              eq(flightBottles.flightId, flight.id),
              notInArray(flightBottles.bottleId, bottleIds),
            ),
          );

        for (const bottle of bottleIds) {
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
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update flight.",
      });
    }

    return await serialize(FlightSerializer, newFlight, context.user);
  });
