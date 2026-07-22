import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import type { Flight, NewTasting, Tasting } from "@peated/server/db/schema";
import {
  bottleReleases,
  bottles,
  bottleTags,
  bottleTombstones,
  flightBottles,
  flights,
  follows,
  tastings,
} from "@peated/server/db/schema";
import { awardAllBadgeXp } from "@peated/server/lib/badges";
import {
  type CatalogTargetAssignmentDescriptor,
  CatalogTargetResolutionError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToTasting,
  getUsablePendingUpload,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware/auth";
import { validateTags } from "@peated/server/orpc/validators/tags";
import {
  BadgeAwardSchema,
  TastingInputSchema,
  TastingSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { dispatchTastingStatsRecompute } from "./dispatchStatsRecompute";
import { isTastingIdentityConflict } from "./isTastingIdentityConflict";

async function findTastingBottle(bottleId: number) {
  return await db.query.bottles.findFirst({
    where: eq(bottles.id, bottleId),
  });
}

type ResolvedTastingIdentityInput =
  | { kind: "target"; targetId: number }
  | { kind: "legacy"; bottleId: number; releaseId: number | null };

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/tastings",
    summary: "Create tasting",
    description:
      "Create a new tasting entry for a bottle with notes, rating, and optional metadata like flight and friends",
    operationId: "createTasting",
  })
  .input(TastingInputSchema)
  .output(
    z.object({
      tasting: TastingSchema,
      awards: z.array(BadgeAwardSchema),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    let resolvedIdentityInput: ResolvedTastingIdentityInput;
    if ("bottle" in input) {
      let legacyBottle = await findTastingBottle(input.bottle);
      if (!legacyBottle) {
        const tombstone = await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, input.bottle),
        });
        if (tombstone?.newBottleId) {
          legacyBottle = await findTastingBottle(tombstone.newBottleId);
        }
      }
      if (!legacyBottle) {
        throw errors.BAD_REQUEST({
          message: "Cannot identify bottle.",
        });
      }

      const releaseId = input.release ?? null;
      if (releaseId) {
        const release = await db.query.bottleReleases.findFirst({
          where: and(
            eq(bottleReleases.id, releaseId),
            eq(bottleReleases.bottleId, legacyBottle.id),
          ),
        });
        if (!release) {
          throw errors.BAD_REQUEST({
            message: "Cannot identify release.",
          });
        }
      }
      resolvedIdentityInput = {
        kind: "legacy",
        bottleId: legacyBottle.id,
        releaseId,
      };
    } else {
      resolvedIdentityInput = { kind: "target", targetId: input.target };
    }

    if (input.pendingImageId) {
      try {
        const pendingUpload = await getUsablePendingUpload({
          id: input.pendingImageId,
          userId: context.user.id,
        });
        if (pendingUpload.purpose !== "photo_tasting_entry") {
          throw new PendingUploadError("Pending upload purpose mismatch.");
        }
      } catch (err) {
        if (err instanceof PendingUploadError) {
          throw errors.BAD_REQUEST({
            message: err.message || "Pending photo is no longer available.",
          });
        }
        throw err;
      }
    }

    const data: NewTasting = {
      notes: input.notes || null,
      rating: input.rating || null,
      servingStyle: input.servingStyle || null,
      color: input.color || null,
      tags: input.tags ? await validateTags(input.tags) : [],
      createdById: context.user.id,
    };
    if (input.createdAt) {
      data.createdAt = new Date(input.createdAt);
    }

    if (input.friends && input.friends.length) {
      const friendUserIds = Array.from(new Set(input.friends));
      const matches = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.fromUserId, context.user.id),
            eq(follows.status, "following"),
            inArray(follows.toUserId, friendUserIds),
          ),
        );
      if (matches.length != friendUserIds.length) {
        throw errors.BAD_REQUEST({
          message: "Friends must all be active relationships.",
        });
      }
      data.friends = input.friends;
    }

    const created = await db.transaction(async (tx) => {
      let target: CatalogTargetAssignmentDescriptor;
      try {
        target = await resolveCatalogTargetForAssignment(
          resolvedIdentityInput.kind === "legacy"
            ? {
                ...resolvedIdentityInput,
                context: {
                  caller: "tastings.create",
                  operation: "create",
                },
              }
            : resolvedIdentityInput,
          tx,
        );
        await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
      } catch (error) {
        if (
          resolvedIdentityInput.kind === "target" &&
          error instanceof CatalogTargetResolutionError
        ) {
          throw errors.BAD_REQUEST({
            message: "Cannot identify catalog target.",
            cause: error,
          });
        }
        throw error;
      }
      let flight: Flight | null = null;
      if (input.flight) {
        const flightResults = await tx
          .select()
          .from(flights)
          .innerJoin(flightBottles, eq(flightBottles.flightId, flights.id))
          .where(
            and(
              eq(flights.publicId, input.flight),
              eq(flightBottles.targetId, target.targetId),
            ),
          )
          .limit(1);
        if (flightResults.length !== 1) {
          throw errors.BAD_REQUEST({
            message: "Cannot identify flight.",
          });
        }
        flight = flightResults[0].flight;
      }

      const identity =
        resolvedIdentityInput.kind === "legacy"
          ? {
              bottleId: resolvedIdentityInput.bottleId,
              releaseId: resolvedIdentityInput.releaseId,
            }
          : { bottleId: target.bottleId, releaseId: null };
      let tasting: Tasting | undefined;
      try {
        [tasting] = await tx
          .insert(tastings)
          .values({
            ...data,
            ...identity,
            flightId: flight?.id ?? null,
            targetId: target.targetId,
          })
          .returning();
      } catch (error) {
        if (isTastingIdentityConflict(error)) {
          throw errors.CONFLICT({
            message: "Tasting already exists.",
            cause: error,
          });
        }
        throw error;
      }
      if (!tasting) return null;

      if (tasting.releaseId) {
        await tx
          .update(bottleReleases)
          .set({
            totalTastings: sql`${bottleReleases.totalTastings} + 1`,
          })
          .where(eq(bottleReleases.id, tasting.releaseId));
      }

      const targetBottleId = target.bottleId;
      if (targetBottleId !== null) {
        await Promise.all(
          tasting.tags.map((tag) =>
            tx
              .insert(bottleTags)
              .values({
                bottleId: targetBottleId,
                tag,
                count: 1,
              })
              .onConflictDoUpdate({
                target: [bottleTags.bottleId, bottleTags.tag],
                set: {
                  count: sql<string>`${bottleTags.count} + 1`,
                },
              }),
          ),
        );
      }

      const awards = await awardAllBadgeXp(tx, tasting);

      for (const award of awards) {
        Object.assign(award, {
          badge: await serialize(BadgeSerializer, award.badge, context.user),
        });
      }

      return { tasting, awards, target };
    });

    if (!created) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to create tasting.",
      });
    }
    let { tasting } = created;
    const { awards, target } = created;

    if (input.pendingImageId) {
      try {
        const imageUrl = await copyPendingImageToTasting({
          id: input.pendingImageId,
          userId: context.user.id,
          purpose: "photo_tasting_entry",
          tastingId: tasting.id,
        });
        [tasting] = await db
          .update(tastings)
          .set({ imageUrl })
          .where(eq(tastings.id, tasting.id))
          .returning();
      } catch (err) {
        logError(err, {
          tasting: {
            id: tasting.id,
          },
          pendingUpload: {
            id: input.pendingImageId,
          },
        });
      }
    }

    if (!context.user.private) {
      try {
        await pushJob("NotifyDiscordOnTasting", { tastingId: tasting.id });
      } catch (err) {
        logError(err, {
          tasting: {
            id: tasting.id,
          },
        });
      }
    }

    await dispatchTastingStatsRecompute(tasting.id, target);

    return {
      tasting: await serialize(TastingSerializer, tasting, context.user),
      awards: await serialize(BadgeAwardSerializer, awards || [], context.user),
    };
  });
