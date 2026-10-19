import { db } from "@peated/server/db";
import { tastingDrafts, type TastingDraft } from "@peated/server/db/schema";
import { logError, logInfo } from "@peated/server/lib/log";
import { isModelServiceUnavailable } from "@peated/server/lib/openaiClient";
import {
  identifyBottlePhoto,
  PHOTO_IDENTIFICATION_RATE_LIMIT,
  type IdentifyBottlePhotoServices,
} from "@peated/server/lib/photoIdentification";
import { takeRateLimit } from "@peated/server/orpc/middleware/rateLimit";
import { type StoredTastingDraftIdentification } from "@peated/server/schemas/tastingDrafts";
import { pushJob, pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

/** Attempts before a draft's identification is marked failed. */
export const MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS = 3;

/**
 * How long a pending draft waits before the sweep queues it again. It is
 * longer than the photo budget window, the longest delay a job puts on
 * itself, so the sweep only picks up jobs that were lost or failed.
 */
export const STALE_TASTING_DRAFT_IDENTIFICATION_MS = 2 * 60 * 60 * 1000;

const SWEEP_LIMIT = 500;

/**
 * Queues identification after a draft with a new photo is saved. The draft
 * is already `pending`, so a failed push is logged and the sweep queues it
 * later.
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
>): StoredTastingDraftIdentification {
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

async function markFailed(draft: Pick<TastingDraft, "id" | "imageUrl">) {
  await db
    .update(tastingDrafts)
    .set({ identificationStatus: "failed" })
    .where(samePendingPhoto(draft));
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

  if (
    draft.identificationAttempts >= MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS
  ) {
    await markFailed(draft);
    return;
  }

  // Photo budget rule: drafts share the member's photo identification budget.
  // Over budget, wait for the window to reset without using an attempt.
  const retryAfterMs = await takeRateLimit(
    PHOTO_IDENTIFICATION_RATE_LIMIT,
    String(draft.createdById),
  );
  if (retryAfterMs !== null) {
    await db
      .update(tastingDrafts)
      .set({ identificationQueuedAt: new Date() })
      .where(samePendingPhoto(draft));
    await pushJob("IdentifyTastingDraft", { draftId }, { delay: retryAfterMs });
    return;
  }

  const [claimed] = await db
    .update(tastingDrafts)
    .set({
      identificationAttempts: sql`${tastingDrafts.identificationAttempts} + 1`,
    })
    .where(
      and(
        samePendingPhoto(draft),
        lt(
          tastingDrafts.identificationAttempts,
          MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS,
        ),
      ),
    )
    .returning({ attempts: tastingDrafts.identificationAttempts });
  if (!claimed) return;

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
    if (error instanceof Error && isModelServiceUnavailable(error)) {
      // The models queue puts this job back; an outage is not an attempt.
      await db
        .update(tastingDrafts)
        .set({
          identificationAttempts: sql`${tastingDrafts.identificationAttempts} - 1`,
        })
        .where(
          and(
            samePendingPhoto(draft),
            gte(tastingDrafts.identificationAttempts, 1),
          ),
        );
    } else if (claimed.attempts >= MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS) {
      await markFailed(draft);
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

/**
 * Queues pending drafts whose identification job was lost or failed, and
 * marks drafts that used every attempt as failed. Runs hourly.
 */
export async function retryStaleTastingDraftIdentifications({
  now = new Date(),
}: { now?: Date } = {}): Promise<{ queued: number; failed: number }> {
  const staleBefore = new Date(
    now.getTime() - STALE_TASTING_DRAFT_IDENTIFICATION_MS,
  );
  const stale = and(
    eq(tastingDrafts.identificationStatus, "pending"),
    or(
      isNull(tastingDrafts.identificationQueuedAt),
      lt(tastingDrafts.identificationQueuedAt, staleBefore),
    ),
  );

  const failed = await db
    .update(tastingDrafts)
    .set({ identificationStatus: "failed" })
    .where(
      and(
        stale,
        gte(
          tastingDrafts.identificationAttempts,
          MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS,
        ),
      ),
    )
    .returning({ id: tastingDrafts.id });

  const due = db
    .select({ id: tastingDrafts.id })
    .from(tastingDrafts)
    .where(stale)
    .orderBy(tastingDrafts.identificationQueuedAt)
    .limit(SWEEP_LIMIT);
  const queued = await db
    .update(tastingDrafts)
    .set({ identificationQueuedAt: now })
    .where(and(stale, inArray(tastingDrafts.id, due)))
    .returning({ id: tastingDrafts.id });

  for (const { id } of queued) {
    try {
      await pushUniqueJob("IdentifyTastingDraft", { draftId: id });
    } catch (error) {
      // The draft stays pending and becomes stale again.
      logError(error, {
        extra: { tastingDraftId: id, operation: "tastingDraft.identify" },
      });
    }
  }

  return { queued: queued.length, failed: failed.length };
}
