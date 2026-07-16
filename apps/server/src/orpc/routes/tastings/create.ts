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
import { resolveCatalogTargetForAssignment } from "@peated/server/lib/catalogTargets";
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

async function findTastingBottle(bottleId: number) {
  return await db.query.bottles.findFirst({
    where: eq(bottles.id, bottleId),
    with: {
      bottler: true,
      brand: true,
      bottlesToDistillers: {
        with: {
          distiller: true,
        },
      },
    },
  });
}

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
    let bottle = await findTastingBottle(input.bottle);
    if (!bottle) {
      const tombstone = await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, input.bottle),
      });
      if (tombstone?.newBottleId) {
        bottle = await findTastingBottle(tombstone.newBottleId);
      }
    }
    if (!bottle) {
      throw errors.BAD_REQUEST({
        message: "Cannot identify bottle.",
      });
    }

    if (input.release) {
      const release = await db.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.id, input.release),
          eq(bottleReleases.bottleId, bottle.id),
        ),
      });
      if (!release) {
        throw errors.BAD_REQUEST({
          message: "Cannot identify release.",
        });
      }
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

    let flight: Flight | null = null;
    if (input.flight) {
      const flightResults = await db
        .select()
        .from(flights)
        .innerJoin(flightBottles, eq(flightBottles.flightId, flights.id))
        .where(
          and(
            eq(flights.publicId, input.flight),
            eq(flightBottles.bottleId, bottle.id),
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

    const data: NewTasting = {
      bottleId: bottle.id,
      releaseId: input.release || null,
      notes: input.notes || null,
      rating: input.rating || null,
      flightId: flight ? flight.id : null,
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
      const target = await resolveCatalogTargetForAssignment(
        {
          kind: "legacy",
          bottleId: bottle.id,
          releaseId: input.release ?? null,
          context: {
            caller: "tastings.create",
            operation: "create",
          },
        },
        tx,
      );
      let tasting: Tasting | undefined;
      try {
        [tasting] = await tx
          .insert(tastings)
          .values({ ...data, targetId: target.targetId })
          .returning();
      } catch (err: any) {
        if (
          err?.code === "23505" &&
          ["tasting_unq", "tasting_target_unq"].includes(err?.constraint)
        ) {
          throw errors.CONFLICT({
            message: "Tasting already exists.",
            cause: err,
          });
        }
        throw err;
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

      await Promise.all(
        tasting.tags.map((tag) =>
          tx
            .insert(bottleTags)
            .values({
              bottleId: bottle.id,
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

      const awards = await awardAllBadgeXp(tx, {
        ...tasting,
        bottle,
      });

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

    await dispatchTastingStatsRecompute(tasting.id, target, tasting.bottleId);

    return {
      tasting: await serialize(TastingSerializer, tasting, context.user),
      awards: await serialize(BadgeAwardSerializer, awards || [], context.user),
    };
  });
