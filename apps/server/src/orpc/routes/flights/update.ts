import { db } from "@peated/server/db";
import {
  type Flight,
  type FlightBottle,
  flightBottles,
  flights,
} from "@peated/server/db/schema";
import {
  type CatalogTargetAssignmentDescriptor,
  CatalogTargetResolutionError,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  FlightLegacyInputSchema,
  FlightSchema,
  FlightTargetInputSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveFlightTargetAssignments } from "./targetAssignments";

const FlightUpdateCommonSchema = z.object({
  flight: z.string(),
  name: z.string().trim().min(1, "Required").optional(),
  description: z.string().nullable().optional(),
  public: z.boolean().optional(),
});
const InputSchema = z.union([
  FlightUpdateCommonSchema.extend({
    targets: FlightTargetInputSchema.shape.targets,
  }).strict(),
  FlightUpdateCommonSchema.extend({
    bottles: FlightLegacyInputSchema.shape.bottles,
  }).strict(),
]);

const MAX_MEMBERSHIP_REPLACEMENT_ATTEMPTS = 3;

class FlightMembershipSnapshotChangedError extends Error {}

function membershipSnapshotKey(
  membership: Pick<FlightBottle, "bottleId" | "releaseId" | "targetId">,
): string {
  return [
    membership.bottleId,
    membership.releaseId ?? "null",
    membership.targetId ?? "null",
  ].join(":");
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
      "Update flight information including name, description, and catalog target membership. Only the flight creator or moderator can update",
    operationId: "updateFlight",
  })
  .use(requireAuth)
  .use(requireTosAccepted)
  .input(InputSchema)
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const { flight: flightId, ...inputData } = input;
    const selection =
      "bottles" in inputData
        ? { kind: "bottles" as const, ids: inputData.bottles }
        : "targets" in inputData && inputData.targets !== undefined
          ? { kind: "targets" as const, ids: inputData.targets }
          : null;
    const {
      bottles: _bottles,
      targets: _targets,
      ...data
    } = {
      bottles: undefined,
      targets: undefined,
      ...inputData,
    };

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

    const replacesMembership = selection !== null;
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
            // The snapshot identifies the existing hierarchy targets to lock
            // before the Flight and its memberships. A mismatch aborts the
            // transaction so the bounded outer loop retries with a fresh set.
            const membershipSnapshot = await tx
              .select()
              .from(flightBottles)
              .where(eq(flightBottles.flightId, flight.id));
            let assignments: Awaited<
              ReturnType<typeof resolveFlightTargetAssignments>
            >;
            try {
              assignments = await resolveFlightTargetAssignments(
                tx,
                selection,
                { caller: "flights.update", operation: "replace" },
              );
              const existingTargets: CatalogTargetAssignmentDescriptor[] = [];
              const existingTargetIds = [
                ...new Set(
                  membershipSnapshot.flatMap(({ targetId }) =>
                    targetId === null ? [] : [targetId],
                  ),
                ),
              ].sort((a, b) => a - b);
              for (const targetId of existingTargetIds) {
                existingTargets.push(
                  await resolveCatalogTargetForAssignment(
                    { kind: "target", targetId },
                    tx,
                  ),
                );
              }
              await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
                ...assignments.map(({ target }) => target),
                ...existingTargets,
              ]);
            } catch (error) {
              if (!(error instanceof CatalogTargetResolutionError)) {
                throw error;
              }
              const currentMemberships = await tx
                .select()
                .from(flightBottles)
                .where(eq(flightBottles.flightId, flight.id));
              if (
                !membershipSnapshotsMatch(
                  membershipSnapshot,
                  currentMemberships,
                )
              ) {
                throw new FlightMembershipSnapshotChangedError();
              }
              throw error;
            }

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
            if (assignments.length) {
              await tx.insert(flightBottles).values(
                assignments.map(({ target, retainedBottleId }) => ({
                  flightId: currentFlight.id,
                  targetId: target.targetId,
                  bottleId: retainedBottleId,
                  releaseId: null,
                })),
              );
            }
            return updatedFlight;
          });
          break;
        } catch (error) {
          if (error instanceof CatalogTargetResolutionError) {
            throw errors.CONFLICT({ message: error.message, cause: error });
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
