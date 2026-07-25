import { db } from "@peated/server/db";
import {
  type Flight,
  type FlightBottle,
  flightBottles,
  flights,
} from "@peated/server/db/schema";
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
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    flight: z.string(),
    name: FlightInputSchema.shape.name.optional(),
    description: FlightInputSchema.shape.description,
    public: z.boolean().optional(),
    bottles: FlightInputSchema.shape.bottles,
  })
  .strict();

const MAX_MEMBERSHIP_REPLACEMENT_ATTEMPTS = 3;

class FlightMembershipSnapshotChangedError extends Error {}

function membershipSnapshotKey(
  membership: Pick<FlightBottle, "bottleId">,
): string {
  return String(membership.bottleId);
}

function membershipSnapshotsMatch(
  first: FlightBottle[],
  second: FlightBottle[],
): boolean {
  if (first.length !== second.length) return false;
  const firstKeys = first.map(membershipSnapshotKey).sort();
  const secondKeys = second.map(membershipSnapshotKey).sort();
  return firstKeys.every((key, index) => key === secondKeys[index]);
}

export default procedure
  .route({
    method: "PATCH",
    path: "/flights/{flight}",
    summary: "Update flight",
    description:
      "Update flight information including name, description, and Bottle membership. Only the flight creator or moderator can update",
    operationId: "updateFlight",
  })
  .use(requireAuth)
  .use(requireTosAccepted)
  .input(InputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const { flight: flightId, bottles: selectedBottles, ...data } = input;
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

    const replacesMembership = selectedBottles !== undefined;
    if (Object.values(data).length === 0 && !replacesMembership) {
      return await serialize(FlightSerializer, flight, context.user);
    }

    let newFlight: Flight | undefined;
    // Preflight authorization can become stale: metadata writes recheck it in
    // the predicate, while membership replacements recheck after locking.
    if (!replacesMembership) {
      [newFlight] = await db
        .update(flights)
        .set(data)
        .where(
          context.user.mod
            ? eq(flights.id, flight.id)
            : and(
                eq(flights.id, flight.id),
                eq(flights.createdById, context.user.id),
              ),
        )
        .returning();
    } else {
      for (
        let attempt = 1;
        attempt <= MAX_MEMBERSHIP_REPLACEMENT_ATTEMPTS;
        attempt += 1
      ) {
        try {
          newFlight = await db.transaction(async (tx) => {
            const membershipSnapshot = await tx
              .select()
              .from(flightBottles)
              .where(eq(flightBottles.flightId, flight.id));
            const bottleIds = await resolveActiveBottleIds(tx, selectedBottles);

            const [currentFlight] = await tx
              .select()
              .from(flights)
              .where(eq(flights.id, flight.id))
              .limit(1)
              .for("update");
            if (!currentFlight) {
              throw errors.NOT_FOUND({
                message: "Flight not found.",
              });
            }
            if (
              currentFlight.createdById !== context.user.id &&
              !context.user.mod
            ) {
              throw errors.FORBIDDEN({
                message: "Cannot update another user's flight.",
              });
            }

            const lockedMemberships = await tx
              .select()
              .from(flightBottles)
              .where(eq(flightBottles.flightId, currentFlight.id))
              .for("update");
            if (
              !membershipSnapshotsMatch(membershipSnapshot, lockedMemberships)
            ) {
              throw new FlightMembershipSnapshotChangedError();
            }

            const [updatedFlight] = Object.values(data).length
              ? await tx
                  .update(flights)
                  .set(data)
                  .where(eq(flights.id, currentFlight.id))
                  .returning()
              : [currentFlight];

            await tx
              .delete(flightBottles)
              .where(eq(flightBottles.flightId, currentFlight.id));
            if (bottleIds.length) {
              await tx.insert(flightBottles).values(
                bottleIds.map((bottleId) => ({
                  flightId: currentFlight.id,
                  bottleId,
                  releaseId: null,
                })),
              );
            }
            return updatedFlight;
          });
          break;
        } catch (error) {
          if (error instanceof ActiveBottleSelectionError) {
            throw errors.BAD_REQUEST({
              message:
                "One or more Bottles are missing or not ready for Flight activity.",
              cause: error,
            });
          }
          if (
            !(error instanceof FlightMembershipSnapshotChangedError) ||
            attempt === MAX_MEMBERSHIP_REPLACEMENT_ATTEMPTS
          ) {
            throw error;
          }
        }
      }
    }

    if (!newFlight) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update flight.",
      });
    }

    return await serialize(FlightSerializer, newFlight, context.user);
  });
