import { db } from "@peated/server/db";
import { tastingDrafts, type TastingDraft } from "@peated/server/db/schema";
import { logError, logInfo } from "@peated/server/lib/log";
import { isModelServiceUnavailable } from "@peated/server/lib/openaiClient";
import {
  identifyBottlePhoto,
  PHOTO_IDENTIFICATION_RATE_LIMIT,
  type IdentifyBottlePhotoServices,
} from "@peated/server/lib/photoIdentification";
import { consumeRateLimit } from "@peated/server/orpc/middleware/rateLimit";
import { type PersistedTastingDraftIdentification } from "@peated/server/schemas/tastingDrafts";
import { pushJob } from "@peated/server/worker/dispatch";
import { and, eq } from "drizzle-orm";

/**
 * Queues identification after a draft with a new photo is saved. The save
 * already committed, so a failed push is logged. The draft stays `pending`
 * until the member saves a new photo, and can still be finished by search.
 */
export async function queueTastingDraftIdentification(draftId: string) {
  try {
    await pushJob("IdentifyTastingDraft", { draftId });
  } catch (error) {
    logError(error, {
      extra: { tastingDraftId: draftId, operation: "tastingDraft.identify" },
    });
  }
}

/**
 * Keeps only results the member can act on: a match or a new Bottle that
 * photo identification would suggest confirming. Everything else means the
 * member searches for the Bottle.
 */
function buildStoredIdentification({
  classification,
  imageEvidence,
  suggestedNextStep,
}: Awaited<
  ReturnType<typeof identifyBottlePhoto>
>): PersistedTastingDraftIdentification {
  if (classification.status === "classified") {
    const { decision } = classification;
    if (suggestedNextStep === "confirm_match" && decision.action === "match") {
      return { action: "match", bottleId: decision.matchedBottleId };
    }
    if (
      suggestedNextStep === "confirm_create" &&
      decision.action === "create_bottle"
    ) {
      return {
        action: "create_bottle",
        decision,
        photoSuitability: imageEvidence.photoSuitability,
      };
    }
  }
  return { action: "no_match" };
}

/** Matches the draft only while it still waits on this same photo. */
function samePendingPhoto(draft: Pick<TastingDraft, "id" | "imageUrl">) {
  return and(
    eq(tastingDrafts.id, draft.id),
    eq(tastingDrafts.identificationStatus, "pending"),
    eq(tastingDrafts.imageUrl, draft.imageUrl!),
  );
}

/**
 * Identifies the Bottle in a draft's photo and saves the result on the draft.
 *
 * Tasting draft rule: this never sets the draft's Bottle and never creates a
 * Bottle. The member confirms the result. A result is saved only if the draft
 * still has the photo it was made from.
 */
export async function identifyTastingDraft(
  draftId: string,
  services?: IdentifyBottlePhotoServices,
): Promise<void> {
  const draft = await db.query.tastingDrafts.findFirst({
    where: eq(tastingDrafts.id, draftId),
  });
  // Deleted, posted, already identified, or the photo was removed.
  if (!draft || draft.identificationStatus !== "pending" || !draft.imageUrl) {
    return;
  }
  const imageUrl = draft.imageUrl;

  // Photo identification limit rule: drafts share the member's hourly limit
  // with the photo route. Over the limit, wait for the window to reset.
  const retryAfterMs = await consumeRateLimit(
    PHOTO_IDENTIFICATION_RATE_LIMIT,
    String(draft.createdById),
  );
  if (retryAfterMs !== null) {
    await pushJob("IdentifyTastingDraft", { draftId }, { delay: retryAfterMs });
    return;
  }

  let identification: Awaited<ReturnType<typeof identifyBottlePhoto>>;
  try {
    identification = await identifyBottlePhoto(
      {
        photo: { id: draft.id, imageUrl },
        traceAttributes: { "photo_identification.tasting_draft_id": draft.id },
      },
      services,
    );
  } catch (error) {
    // The models queue puts the job back during an AI service outage. Any
    // other error is final: it is reported, and the member searches instead.
    if (!(error instanceof Error && isModelServiceUnavailable(error))) {
      await db
        .update(tastingDrafts)
        .set({ identificationStatus: "failed" })
        .where(samePendingPhoto(draft));
    }
    throw error;
  }

  const [saved] = await db
    .update(tastingDrafts)
    .set({
      identificationStatus: "done",
      identification: buildStoredIdentification(identification),
    })
    .where(samePendingPhoto(draft))
    .returning({ id: tastingDrafts.id });
  if (!saved) {
    logInfo("Ignored identification for a replaced tasting draft photo", {
      extra: { tastingDraftId: draft.id },
    });
  }
}
