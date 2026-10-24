import { db } from "@peated/server/db";
import type { Flight, NewTasting } from "@peated/server/db/schema";
import { flightBottles, flights, tastings } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToTasting,
  getUsablePendingUpload,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import { implement } from "@peated/server/orpc";
import tastingCreateContract from "@peated/server/orpc/contracts/tastings/create";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware/auth";
import { validateFriends } from "@peated/server/orpc/validators/friends";
import { validateTags } from "@peated/server/orpc/validators/tags";
import { serialize } from "@peated/server/serializers";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { and, eq } from "drizzle-orm";
import { dispatchTastingStatsRecompute } from "./dispatchStatsRecompute";
import { findTastingByIdempotencyKey, insertTasting } from "./insertTasting";

export default implement(tastingCreateContract)
  .use(requireAuth)
  .use(requireTosAccepted)
  .handler(async function ({ input, context, errors }) {
    // A retried post returns the tasting it already created. Check this first
    // so a retry still succeeds after its pending photo expires.
    if (input.idempotencyKey) {
      const existing = await findTastingByIdempotencyKey(
        db,
        context.user.id,
        input.idempotencyKey,
      );
      if (existing) {
        return {
          tasting: await serialize(TastingSerializer, existing, context.user),
          awards: [],
        };
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

    const createdAt = new Date();
    const data: Omit<NewTasting, "bottleId"> = {
      notes: input.notes || null,
      ratingBand: input.ratingBand ?? null,
      servingStyle: input.servingStyle || null,
      color: input.color || null,
      tags: input.tags ? await validateTags(input.tags) : [],
      createdById: context.user.id,
      createdAt,
      tastedAt: input.tastedAt ? new Date(input.tastedAt) : createdAt,
      idempotencyKey: input.idempotencyKey ?? null,
    };

    if (input.friends && input.friends.length) {
      await validateFriends(context.user.id, input.friends);
      data.friends = input.friends;
    }

    const bottleId = input.bottle;
    const created = await db.transaction(async (tx) => {
      let flight: Flight | null = null;
      if (input.flight) {
        const flightResults = await tx
          .select()
          .from(flights)
          .innerJoin(flightBottles, eq(flightBottles.flightId, flights.id))
          .where(
            and(
              eq(flights.publicId, input.flight),
              eq(flightBottles.bottleId, bottleId),
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

      return await insertTasting(
        tx,
        { ...data, bottleId, flightId: flight?.id ?? null },
        context.user,
      );
    });

    if (created.replayed) {
      return {
        tasting: await serialize(
          TastingSerializer,
          created.tasting,
          context.user,
        ),
        awards: [],
      };
    }
    let { tasting } = created;
    const { awards } = created;

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

    await dispatchTastingStatsRecompute(tasting.id, bottleId);

    return {
      tasting: await serialize(TastingSerializer, tasting, context.user),
      awards: await serialize(BadgeAwardSerializer, awards || [], context.user),
    };
  });
