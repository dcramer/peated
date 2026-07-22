import { db } from "@peated/server/db";
import type { Flight, NewFlight } from "@peated/server/db/schema";
import { flightBottles, flights } from "@peated/server/db/schema";
import {
  CatalogTargetResolutionError,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
} from "@peated/server/lib/catalogTargets";
import { generatePublicId } from "@peated/server/lib/publicId";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { FlightInputSchema, FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { resolveFlightTargetAssignments } from "./targetAssignments";

export default procedure
  .route({
    method: "POST",
    path: "/flights",
    summary: "Create flight",
    description:
      "Create a new tasting flight with catalog targets and visibility settings",
    operationId: "createFlight",
  })
  .use(requireAuth)
  .use(requireTosAccepted)
  .input(FlightInputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const selection =
      "bottles" in input
        ? { kind: "bottles" as const, ids: input.bottles }
        : { kind: "targets" as const, ids: input.targets ?? [] };
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
        const assignments = await resolveFlightTargetAssignments(
          tx,
          selection,
          { caller: "flights.create", operation: "create" },
        );
        await lockCatalogTargetAssignmentDescriptorsInTransaction(
          tx,
          assignments.map(({ target }) => target),
        );

        const [flight] = await tx.insert(flights).values(data).returning();

        for (const { target, retainedBottleId } of assignments) {
          await tx.insert(flightBottles).values({
            flightId: flight.id,
            targetId: target.targetId,
            bottleId: retainedBottleId,
            releaseId: null,
          });
        }

        return flight;
      });
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
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
