import { db } from "@peated/server/db";
import {
  tastingDrafts,
  type NewTastingDraft,
  type TastingDraft,
} from "@peated/server/db/schema";
import {
  copyPendingImageToTastingDraft,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { queueTastingDraftIdentification } from "@peated/server/lib/tastingDraftIdentification";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { findTastingByIdempotencyKey } from "@peated/server/orpc/routes/tastings/insertTasting";
import { validateFriends } from "@peated/server/orpc/validators/friends";
import { validateTags } from "@peated/server/orpc/validators/tags";
import {
  TastingDraftInputSchema,
  TastingDraftSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingDraftSerializer } from "@peated/server/serializers/tastingDraft";
import { count, eq } from "drizzle-orm";
import {
  lockMemberTastingDrafts,
  MAX_TASTING_DRAFTS_PER_USER,
  removeTastingDraftPhoto,
} from "./shared";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "PUT",
    path: "/tasting-drafts/{draft}",
    summary: "Save tasting draft",
    description:
      "Create or replace one of your tasting drafts by its client-chosen ID. The latest save wins. Omitted fields are cleared, except `pendingImageId`: omit it to keep the current photo. A new photo starts identifying its Bottle in the background; see `identification`. Returns `409 CONFLICT` when the ID belongs to another member's draft, or when the draft was already posted; then `data.tasting` holds the posted tasting's ID.",
    operationId: "upsertTastingDraft",
  })
  .input(TastingDraftInputSchema)
  .output(TastingDraftSchema)
  .handler(async ({ input, context, errors }) => {
    const userId = context.user.id;
    const tags = await validateTags(input.tags);
    await validateFriends(userId, input.friends);

    // undefined keeps the current photo.
    let imageUrl: string | null | undefined;
    if (input.pendingImageId === null) {
      imageUrl = null;
    } else if (input.pendingImageId) {
      try {
        imageUrl = await copyPendingImageToTastingDraft({
          id: input.pendingImageId,
          userId,
          purpose: "photo_tasting_entry",
          tastingDraftId: input.draft,
        });
      } catch (err) {
        if (err instanceof PendingUploadError) {
          throw errors.BAD_REQUEST({
            message: err.message || "Pending photo is no longer available.",
          });
        }
        throw err;
      }
    }

    // The draft's photo before this save. undefined until the draft is read.
    let previousImageUrl: string | null | undefined;
    let photoChanged = false;
    let saved: TastingDraft;
    try {
      saved = await db.transaction(async (tx) => {
        await lockMemberTastingDrafts(tx, userId);

        const [existing] = await tx
          .select()
          .from(tastingDrafts)
          .where(eq(tastingDrafts.id, input.draft))
          .for("update");
        previousImageUrl = existing?.imageUrl ?? null;
        if (existing && existing.createdById !== userId) {
          throw errors.CONFLICT({ message: "Draft ID is already in use." });
        }

        // A stale retry after publishing must not bring the draft back.
        const posted = await findTastingByIdempotencyKey(
          tx,
          userId,
          input.draft,
        );
        if (posted) {
          throw errors.CONFLICT({
            message: "This draft was already posted.",
            data: { tasting: posted.id },
          });
        }

        if (!existing) {
          const [{ total }] = await tx
            .select({ total: count() })
            .from(tastingDrafts)
            .where(eq(tastingDrafts.createdById, userId));
          if (total >= MAX_TASTING_DRAFTS_PER_USER) {
            throw errors.BAD_REQUEST({
              message: "You have too many drafts. Post or delete some first.",
            });
          }
        }

        if (input.bottle) {
          try {
            await resolveActiveBottleIds(tx, [input.bottle]);
          } catch (error) {
            if (!(error instanceof ActiveBottleSelectionError)) throw error;
            throw errors.BAD_REQUEST({
              message: "Cannot identify bottle.",
              cause: error,
            });
          }
        }

        const now = new Date();
        const values: Omit<NewTastingDraft, "id" | "createdById"> = {
          tastedAt: new Date(input.tastedAt),
          bottleHint: input.bottleHint || null,
          bottleId: input.bottle,
          notes: input.notes || null,
          ratingBand: input.ratingBand,
          tags,
          servingStyle: input.servingStyle,
          color: input.color,
          friends: input.friends,
          updatedAt: now,
        };
        if (imageUrl !== undefined) values.imageUrl = imageUrl;
        // A new photo starts identification over; the old result was for
        // another photo.
        photoChanged = imageUrl !== undefined && imageUrl !== previousImageUrl;
        if (photoChanged) {
          values.identificationStatus = imageUrl ? "pending" : "none";
          values.identification = null;
        }
        const [draft] = await tx
          .insert(tastingDrafts)
          .values({
            ...values,
            id: input.draft,
            createdById: userId,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: tastingDrafts.id,
            set: values,
            // Only the owner can replace a draft.
            setWhere: eq(tastingDrafts.createdById, userId),
          })
          .returning();
        if (!draft) {
          throw errors.CONFLICT({ message: "Draft ID is already in use." });
        }
        return draft;
      });
    } catch (err) {
      // Remove the copy this save made, unless the draft already used it
      // (a retry with the same pending upload copies to the same file).
      if (
        imageUrl &&
        previousImageUrl !== undefined &&
        imageUrl !== previousImageUrl
      ) {
        await removeTastingDraftPhoto(imageUrl, input.draft);
      }
      throw err;
    }

    if (previousImageUrl && previousImageUrl !== saved.imageUrl) {
      await removeTastingDraftPhoto(previousImageUrl, saved.id);
    }
    if (photoChanged && saved.imageUrl) {
      await queueTastingDraftIdentification(saved.id);
    }

    return await serialize(TastingDraftSerializer, saved, context.user);
  });
