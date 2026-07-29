import { db } from "@peated/server/db";
import type { Flight, NewFlight } from "@peated/server/db/schema";
import { flightBottles, flights } from "@peated/server/db/schema";
import { generatePublicId } from "@peated/server/lib/publicId";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { FlightInputSchema, FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";

export default procedure
  .route({
    method: "POST",
    path: "/flights",
    summary: "Create flight",
    description:
      "Create a new tasting flight with Bottles and visibility settings",
    operationId: "createFlight",
  })
  .use(requireAuth)
  .use(requireTosAccepted)
  .input(FlightInputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const data: NewFlight = {
      name: input.name,
      description: input.description,
      public: input.public,
      publicId: generatePublicId(),
      createdById: context.user.id,
    };

    let flight: Flight | undefined;
    try {
      flight = await db.transaction(async (tx) => {
        const bottleIds = await resolveActiveBottleIds(tx, input.bottles ?? []);

        const [flight] = await tx.insert(flights).values(data).returning();

        if (bottleIds.length) {
          await tx.insert(flightBottles).values(
            bottleIds.map((bottleId) => ({
              flightId: flight.id,
              bottleId,
            })),
          );
        }

        return flight;
      });
    } catch (error) {
      if (error instanceof ActiveBottleSelectionError) {
        throw errors.BAD_REQUEST({
          message:
            "One or more Bottles are missing or not ready for Flight activity.",
          cause: error,
        });
      }
      throw error;
    }

    if (!flight) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create flight.",
      });
    }

    return await serialize(FlightSerializer, flight, context.user);
  });
