import { db } from "@peated/server/db";
import type { NewFlight } from "@peated/server/db/schema";
import { flightBottles, flights } from "@peated/server/db/schema";
import { generatePublicId } from "@peated/server/lib/publicId";
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
      "Create a new tasting flight with bottles and visibility settings",
    operationId: "createFlight",
  })
  .use(requireAuth)
  .use(requireTosAccepted)
  .input(FlightInputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const data: NewFlight = {
      ...input,
      publicId: generatePublicId(),
      createdById: context.user.id,
    };

    const flight = await db.transaction(async (tx) => {
      const [flight] = await tx.insert(flights).values(data).returning();

      if (input.bottles) {
        for (const bottle of input.bottles) {
          await tx.insert(flightBottles).values({
            flightId: flight.id,
            bottleId: bottle,
          });
        }
      }

      return flight;
    });

    if (!flight) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create flight.",
      });
    }

    return await serialize(FlightSerializer, flight, context.user);
  });
