/**
 * Owns Bottle reference reservation and assignment. Exact reservation claims only
 * the reference row; full assignment also migrates matching unresolved consumers.
 */
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import type {
  BottleReference,
  BottleReferenceAssignmentSource,
} from "@peated/server/db/schema";
import {
  bottleImages,
  bottleReferences,
  bottleTombstones,
  bottles,
  externalReviewArticles,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  logError,
  logInfo,
  type SentryLogContexts,
} from "@peated/server/lib/log";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
  type ActiveBottleRejectionReason,
} from "@peated/server/lib/resolveActiveBottleIds";
import { pushJob, pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

/** Lists unresolved, non-ignored references for bounded maintenance output. */
export async function listUnmatchedBottleReferenceNames(
  {
    limit,
    offset,
  }: {
    limit: number;
    offset: number;
  },
  database: AnyDatabase = db,
): Promise<string[]> {
  const rows = await database
    .select({ name: bottleReferences.name })
    .from(bottleReferences)
    .where(
      and(
        sql`${bottleReferences.ignored} IS DISTINCT FROM true`,
        isNull(bottleReferences.bottleId),
      ),
    )
    .orderBy(asc(bottleReferences.name))
    .offset(offset)
    .limit(limit);

  return rows.map(({ name }) => name);
}

export class FailedToSaveBottleReferenceError extends Error {
  constructor() {
    super("Failed to save reference.");
    this.name = "FailedToSaveBottleReferenceError";
  }
}

export class BottleReferenceBottleNotFoundError extends Error {
  constructor(readonly bottleId: number) {
    super(`Bottle ${bottleId} was not found.`);
    this.name = "BottleReferenceBottleNotFoundError";
  }
}

export class BottleReferenceBottleRetiredError extends Error {
  constructor(
    readonly bottleId: number,
    readonly replacementBottleId: number | null,
  ) {
    super(
      replacementBottleId === null
        ? `Bottle ${bottleId} is retired.`
        : `Bottle ${bottleId} is retired in favor of Bottle ${replacementBottleId}.`,
    );
    this.name = "BottleReferenceBottleRetiredError";
  }
}

export type BottleReferenceBottleInactiveReason = Extract<
  ActiveBottleRejectionReason,
  "unassigned"
>;

export class BottleReferenceBottleInactiveError extends Error {
  constructor(
    readonly bottleId: number,
    readonly reason: BottleReferenceBottleInactiveReason,
  ) {
    super(
      reason === "unassigned"
        ? `Bottle ${bottleId} is not assigned to a BottleGroup.`
        : `Bottle ${bottleId} belongs to a retired BottleGroup.`,
    );
    this.name = "BottleReferenceBottleInactiveError";
  }
}

export class StaleBottleReferenceReviewIdentityError extends Error {
  constructor(readonly reviewId: number) {
    super(
      `Review ${reviewId} changed while its Bottle reference was resolving.`,
    );
    this.name = "StaleBottleReferenceReviewIdentityError";
  }
}

export type BottleReferenceIdentitySnapshot = Pick<
  BottleReference,
  "name" | "bottleId" | "ignored" | "assignmentSource" | "assignedByActorId"
>;

export class ExactBottleReferenceConflictError extends Error {
  constructor(
    readonly code: "another_bottle",
    readonly reference: BottleReferenceIdentitySnapshot,
    readonly conflictingBottleId: number | null,
  ) {
    super(
      `Cannot reserve exact Bottle reference "${reference.name}": ${code}.`,
    );
    this.name = "ExactBottleReferenceConflictError";
  }
}

export class BottleReferenceIdentityChangedError extends Error {
  constructor(readonly referenceName: string) {
    super(
      `Bottle reference identity changed during assignment (${referenceName}).`,
    );
    this.name = "BottleReferenceIdentityChangedError";
  }
}

export class BottleReferenceNotFoundError extends Error {
  constructor(readonly referenceId: number) {
    super(`Bottle reference ${referenceId} was not found.`);
    this.name = "BottleReferenceNotFoundError";
  }
}

export class StaleBottleReferenceCorrectionError extends Error {
  constructor(
    readonly referenceId: number,
    readonly expectedBottleId: number | null,
    readonly actualBottleId: number | null,
    readonly expectedIgnored: boolean,
    readonly actualIgnored: boolean,
  ) {
    super(`Bottle reference ${referenceId} changed before it was corrected.`);
    this.name = "StaleBottleReferenceCorrectionError";
  }
}

export class CanonicalBottleReferenceCorrectionError extends Error {
  constructor(readonly referenceId: number) {
    super("A Bottle's current full name cannot be reassigned or unassigned.");
    this.name = "CanonicalBottleReferenceCorrectionError";
  }
}

export type BottleReferenceReviewIdentitySnapshot = Pick<
  typeof externalReviews.$inferSelect,
  "id" | "name" | "bottleId"
>;

export type BottleReferenceAssignmentInput = {
  bottleId: number;
  externalSiteId?: number;
  name: string;
  backfillNames?: string[];
  volume?: number;
  ignored?: boolean;
  assignmentSource?: BottleReferenceAssignmentSource;
  assignedByActorId: number;
  sourceReferenceIdentity?: BottleReferenceIdentitySnapshot;
  expectedReview?: BottleReferenceReviewIdentitySnapshot;
};

export type BottleReferenceAssignmentOptions = Pick<
  BottleReferenceAssignmentInput,
  "assignmentSource" | "assignedByActorId"
>;

export type BottleImageCandidate = {
  bottleId: number;
  imageUrl: string;
  sourceUrl: string | null;
  createdByActorId: number;
};

export type BottleReferenceAssignmentResult = {
  reference: BottleReferenceIdentitySnapshot;
  referenceChanged: boolean;
  isNew: boolean;
  bottleImageCandidate: BottleImageCandidate | null;
  bottleId: number;
};

type BottleReferenceAssignmentValues = {
  assignmentSource?: BottleReferenceAssignmentSource;
  assignedByActorId: number;
};

function getAssignmentInsertValues({
  assignmentSource = "legacy",
  assignedByActorId,
}: BottleReferenceAssignmentValues) {
  return {
    assignmentSource,
    assignedByActorId,
  };
}

function getAssignmentUpdateValues(options: BottleReferenceAssignmentValues) {
  const values: BottleReferenceAssignmentValues = {
    assignedByActorId: options.assignedByActorId,
  };
  if (options.assignmentSource !== undefined) {
    values.assignmentSource = options.assignmentSource;
  }
  return values;
}

function bottleReferenceIdentityMatches(
  reference: BottleReferenceIdentitySnapshot,
  snapshot: BottleReferenceIdentitySnapshot,
) {
  return (
    reference.name === snapshot.name &&
    reference.bottleId === snapshot.bottleId &&
    reference.ignored === snapshot.ignored &&
    reference.assignmentSource === snapshot.assignmentSource &&
    reference.assignedByActorId === snapshot.assignedByActorId
  );
}

/** Rejects a stale lookup unless a concurrent assignment already converged. */
function assertBottleReferenceIdentitySnapshot(
  lockedReference: BottleReferenceIdentitySnapshot | undefined,
  snapshot: BottleReferenceIdentitySnapshot,
  convergedSnapshot?: BottleReferenceIdentitySnapshot,
): asserts lockedReference is BottleReferenceIdentitySnapshot {
  if (
    !lockedReference ||
    (!bottleReferenceIdentityMatches(lockedReference, snapshot) &&
      (!convergedSnapshot ||
        !bottleReferenceIdentityMatches(lockedReference, convergedSnapshot)))
  ) {
    throw new BottleReferenceIdentityChangedError(snapshot.name);
  }
}

/** Locks a distinct source reference and rejects a stale lookup precondition. */
async function lockBottleReferenceIdentitySnapshotInTransaction(
  tx: AnyTransaction,
  snapshot: BottleReferenceIdentitySnapshot,
): Promise<void> {
  const [lockedReference] = await tx
    .select({
      name: bottleReferences.name,
      bottleId: bottleReferences.bottleId,
      ignored: bottleReferences.ignored,
      assignmentSource: bottleReferences.assignmentSource,
      assignedByActorId: bottleReferences.assignedByActorId,
    })
    .from(bottleReferences)
    .where(eq(bottleReferences.name, snapshot.name))
    .limit(1)
    .for("update");
  assertBottleReferenceIdentitySnapshot(lockedReference, snapshot);
}

async function lockActiveBottleInTransaction(
  tx: AnyTransaction,
  bottleId: number,
) {
  try {
    await resolveActiveBottleIds(tx, [bottleId], { lock: "update" });
  } catch (error) {
    if (!(error instanceof ActiveBottleSelectionError)) throw error;
    if (error.reason === "missing") {
      throw new BottleReferenceBottleNotFoundError(error.bottleId);
    }
    if (error.reason === "bottle_retired") {
      throw new BottleReferenceBottleRetiredError(
        error.bottleId,
        error.replacementBottleId,
      );
    }
    throw new BottleReferenceBottleInactiveError(error.bottleId, error.reason);
  }
}

export type ExactBottleReferenceReservationInput = {
  name: string;
  bottleId: number;
  assignmentSource: BottleReferenceAssignmentSource;
  assignedByActorId: number;
};

type ExactBottleReferenceClaimResult = {
  reference: BottleReferenceIdentitySnapshot;
  inserted: boolean;
  changed: boolean;
};

/** Claims one runtime reference identity without reading or writing legacy evidence. */
async function claimBottleReferenceNameInTransaction(
  tx: AnyTransaction,
  {
    name,
    bottleId,
    expectedIdentity,
    ignored,
    assignmentSource,
    assignedByActorId,
    reservation,
  }: {
    name: string;
    bottleId: number;
    expectedIdentity?: BottleReferenceIdentitySnapshot;
    ignored?: boolean;
    assignmentSource?: BottleReferenceAssignmentSource;
    assignedByActorId: number;
    reservation: boolean;
  },
): Promise<ExactBottleReferenceClaimResult> {
  if (!name.trim()) {
    throw new FailedToSaveBottleReferenceError();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [existingReference] = await tx
      .select({
        name: bottleReferences.name,
        bottleId: bottleReferences.bottleId,
        ignored: bottleReferences.ignored,
        assignmentSource: bottleReferences.assignmentSource,
        assignedByActorId: bottleReferences.assignedByActorId,
      })
      .from(bottleReferences)
      .where(eq(sql`LOWER(${bottleReferences.name})`, name.toLowerCase()))
      .limit(1)
      .for("update");

    if (expectedIdentity) {
      const convergedIdentity: BottleReferenceIdentitySnapshot = {
        name,
        bottleId,
        ignored:
          reservation || expectedIdentity.bottleId === null
            ? (ignored ?? false)
            : expectedIdentity.ignored,
        assignmentSource: assignmentSource ?? expectedIdentity.assignmentSource,
        assignedByActorId,
      };
      assertBottleReferenceIdentitySnapshot(
        existingReference,
        expectedIdentity,
        convergedIdentity,
      );
    }

    if (!existingReference) {
      const [insertedReference] = await tx
        .insert(bottleReferences)
        .values({
          name,
          bottleId,
          ...(reservation
            ? { ignored: false }
            : ignored !== undefined
              ? { ignored }
              : {}),
          ...getAssignmentInsertValues({
            assignmentSource,
            assignedByActorId,
          }),
        })
        .onConflictDoNothing()
        .returning({
          name: bottleReferences.name,
          bottleId: bottleReferences.bottleId,
          ignored: bottleReferences.ignored,
          assignmentSource: bottleReferences.assignmentSource,
          assignedByActorId: bottleReferences.assignedByActorId,
        });
      if (insertedReference) {
        return {
          reference: insertedReference,
          inserted: true,
          changed: true,
        };
      }
      continue;
    }

    if (
      existingReference.bottleId !== null &&
      existingReference.bottleId !== bottleId
    ) {
      throw new ExactBottleReferenceConflictError(
        "another_bottle",
        existingReference,
        existingReference.bottleId,
      );
    }

    const assignmentValues = getAssignmentUpdateValues({
      assignmentSource,
      assignedByActorId,
    });
    const nextIgnored =
      reservation || existingReference.bottleId === null
        ? (ignored ?? false)
        : existingReference.ignored;
    const nextAssignmentSource =
      assignmentSource ?? existingReference.assignmentSource;
    const unchanged =
      existingReference.name === name &&
      existingReference.bottleId === bottleId &&
      existingReference.ignored === nextIgnored &&
      existingReference.assignmentSource === nextAssignmentSource &&
      existingReference.assignedByActorId === assignedByActorId;
    if (unchanged) {
      return {
        reference: existingReference,
        inserted: false,
        changed: false,
      };
    }

    const [updatedReference] = await tx
      .update(bottleReferences)
      .set({
        name,
        bottleId,
        ignored: nextIgnored,
        embedding: null,
        reviewedAt: null,
        reviewedByActorId: null,
        ...assignmentValues,
      })
      .where(eq(bottleReferences.name, existingReference.name))
      .returning({
        name: bottleReferences.name,
        bottleId: bottleReferences.bottleId,
        ignored: bottleReferences.ignored,
        assignmentSource: bottleReferences.assignmentSource,
        assignedByActorId: bottleReferences.assignedByActorId,
      });
    if (updatedReference) {
      return {
        reference: updatedReference,
        inserted: false,
        changed: true,
      };
    }
  }

  throw new FailedToSaveBottleReferenceError();
}

async function reserveExactBottleReferenceNameInTransaction(
  tx: AnyTransaction,
  input: ExactBottleReferenceReservationInput,
): Promise<{ name: string; changed: boolean }> {
  await lockActiveBottleInTransaction(tx, input.bottleId);
  const result = await claimBottleReferenceNameInTransaction(tx, {
    ...input,
    reservation: true,
  });
  return { name: result.reference.name, changed: result.changed };
}

/** Reserves the literal trimmed canonical name already persisted on a Bottle. */
export async function reserveLiteralCanonicalBottleReferenceInTransaction(
  tx: AnyTransaction,
  input: ExactBottleReferenceReservationInput,
): Promise<{ name: string; changed: boolean }> {
  return reserveExactBottleReferenceNameInTransaction(tx, {
    ...input,
    name: input.name.trim(),
  });
}

/** Reserves a normalized canonical reference without migrating other references. */
export async function reserveExactBottleReferenceInTransaction(
  tx: AnyTransaction,
  input: ExactBottleReferenceReservationInput,
): Promise<{ name: string; changed: boolean }> {
  return reserveExactBottleReferenceNameInTransaction(tx, {
    ...input,
    name: normalizeBottleReferenceKey(input.name),
  });
}

async function assertExpectedReviewIdentity(
  tx: AnyTransaction,
  expectedReview: BottleReferenceReviewIdentitySnapshot,
) {
  const [lockedReview] = await tx
    .select({
      id: externalReviews.id,
      name: externalReviews.name,
      bottleId: externalReviews.bottleId,
    })
    .from(externalReviews)
    .where(eq(externalReviews.id, expectedReview.id))
    .limit(1)
    .for("update");
  if (
    !lockedReview ||
    lockedReview.name !== expectedReview.name ||
    lockedReview.bottleId !== expectedReview.bottleId
  ) {
    throw new StaleBottleReferenceReviewIdentityError(expectedReview.id);
  }
}

/**
 * Applies one Bottle id to matching unresolved consumers. Already-resolved rows
 * are changed only when they still match the selected Bottle or an explicit
 * review snapshot proves the caller observed the identity being replaced.
 */
async function syncBottleReferenceConsumersInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    externalSiteId,
    lookupNames,
    volume,
    expectedReview,
  }: {
    bottleId: number;
    externalSiteId?: number;
    lookupNames: string[];
    volume?: number;
    expectedReview?: BottleReferenceReviewIdentitySnapshot;
  },
) {
  if (expectedReview) {
    await assertExpectedReviewIdentity(tx, expectedReview);
  }

  const priceIdentity = or(
    isNull(storePrices.bottleId),
    eq(storePrices.bottleId, bottleId),
  );
  const matchingPrices = await tx
    .update(storePrices)
    .set({ bottleId })
    .where(
      and(
        or(
          ...lookupNames.map((value) =>
            eq(sql`LOWER(${storePrices.name})`, value),
          ),
        ),
        externalSiteId !== undefined
          ? eq(storePrices.externalSiteId, externalSiteId)
          : undefined,
        volume !== undefined ? eq(storePrices.volume, volume) : undefined,
        priceIdentity,
      ),
    )
    .returning({ imageUrl: storePrices.imageUrl, url: storePrices.url });

  const reviewIdentity = or(
    isNull(externalReviews.bottleId),
    eq(externalReviews.bottleId, bottleId),
    expectedReview ? eq(externalReviews.id, expectedReview.id) : undefined,
  );
  await tx
    .update(externalReviews)
    .set({ bottleId })
    .where(
      and(
        or(
          ...lookupNames.map((value) =>
            eq(sql`LOWER(${externalReviews.name})`, value),
          ),
        ),
        externalSiteId !== undefined
          ? inArray(
              externalReviews.articleId,
              tx
                .select({ id: externalReviewArticles.id })
                .from(externalReviewArticles)
                .where(
                  eq(externalReviewArticles.externalSiteId, externalSiteId),
                ),
            )
          : undefined,
        reviewIdentity,
      ),
    );

  const priceWithImage = matchingPrices.find((price) => !!price.imageUrl);
  return {
    bottleImageCandidate: priceWithImage?.imageUrl
      ? {
          bottleId,
          imageUrl: priceWithImage.imageUrl,
          sourceUrl: priceWithImage.url,
        }
      : null,
  };
}

/** Assigns an reference and matching consumers to one independently complete Bottle. */
export async function assignBottleReferenceInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    externalSiteId,
    name,
    backfillNames = [],
    volume,
    ignored,
    assignmentSource,
    assignedByActorId,
    sourceReferenceIdentity,
    expectedReview,
  }: BottleReferenceAssignmentInput,
): Promise<BottleReferenceAssignmentResult> {
  if (!name.trim()) {
    throw new FailedToSaveBottleReferenceError();
  }

  await lockActiveBottleInTransaction(tx, bottleId);
  const lookupNames = Array.from(
    new Set(
      [name, ...backfillNames].map((value) => value.trim().toLowerCase()),
    ),
  ).filter(Boolean);
  const { bottleImageCandidate } =
    await syncBottleReferenceConsumersInTransaction(tx, {
      bottleId,
      externalSiteId,
      lookupNames,
      volume,
      expectedReview,
    });

  const sourceIsCanonicalName =
    sourceReferenceIdentity?.name.toLowerCase() === name.toLowerCase();
  const claimInput: Parameters<
    typeof claimBottleReferenceNameInTransaction
  >[1] = {
    name,
    bottleId,
    ignored,
    assignmentSource,
    assignedByActorId,
    reservation: false,
  };
  if (sourceReferenceIdentity && sourceIsCanonicalName) {
    claimInput.expectedIdentity = sourceReferenceIdentity;
  }
  const claim = await claimBottleReferenceNameInTransaction(tx, claimInput);
  if (sourceReferenceIdentity && !sourceIsCanonicalName) {
    await lockBottleReferenceIdentitySnapshotInTransaction(
      tx,
      sourceReferenceIdentity,
    );
  }

  return {
    reference: claim.reference,
    referenceChanged: claim.changed,
    isNew: claim.inserted,
    bottleImageCandidate: bottleImageCandidate
      ? { ...bottleImageCandidate, createdByActorId: assignedByActorId }
      : null,
    bottleId,
  };
}

/** Replays one assigned reference directly to eligible consumers. */
export async function syncBottleReferenceConsumersForReferenceChange(
  name: string,
) {
  await db.transaction(async (tx) => {
    const [reference] = await tx
      .select({
        name: bottleReferences.name,
        bottleId: bottleReferences.bottleId,
        ignored: bottleReferences.ignored,
        assignmentSource: bottleReferences.assignmentSource,
        assignedByActorId: bottleReferences.assignedByActorId,
      })
      .from(bottleReferences)
      .where(eq(sql`LOWER(${bottleReferences.name})`, name.toLowerCase()))
      .limit(1);
    if (!reference) {
      throw new Error(`Unknown bottle reference: ${name}`);
    }
    if (reference.ignored || reference.bottleId === null) return;

    try {
      await lockActiveBottleInTransaction(tx, reference.bottleId);
    } catch (error) {
      if (
        error instanceof BottleReferenceBottleNotFoundError ||
        error instanceof BottleReferenceBottleRetiredError ||
        error instanceof BottleReferenceBottleInactiveError
      ) {
        return;
      }
      throw error;
    }
    await syncBottleReferenceConsumersInTransaction(tx, {
      bottleId: reference.bottleId,
      lookupNames: [reference.name.toLowerCase()],
    });

    const [unchangedReference] = await tx
      .select({ name: bottleReferences.name })
      .from(bottleReferences)
      .where(
        and(
          eq(bottleReferences.name, reference.name),
          sql`${bottleReferences.bottleId} IS NOT DISTINCT FROM ${reference.bottleId}`,
          sql`${bottleReferences.ignored} IS NOT DISTINCT FROM ${reference.ignored}`,
          sql`${bottleReferences.assignmentSource} IS NOT DISTINCT FROM ${reference.assignmentSource}`,
          sql`${bottleReferences.assignedByActorId} IS NOT DISTINCT FROM ${reference.assignedByActorId}`,
        ),
      )
      .limit(1)
      .for("update");
    if (!unchangedReference) {
      throw new BottleReferenceIdentityChangedError(reference.name);
    }
  });
}

function recordUnresolvedBottleImageCandidate(
  candidate: BottleImageCandidate,
  reason:
    | "missing_tombstone"
    | "missing_replacement_mapping"
    | "missing_replacement_bottle",
) {
  logInfo("Unable to apply Bottle reference image candidate", {
    extra: {
      event: "bottle_reference.image_candidate_unresolved",
      reason,
      bottleId: candidate.bottleId,
      imageUrl: candidate.imageUrl,
    },
  });
}

/**
 * Runs after commit, fills only missing Bottle images (following a merged
 * source through its tombstone), and logs image/index/notification failures as
 * nonfatal side effects.
 */
export async function finalizeBottleReferenceAssignment(
  {
    reference,
    referenceChanged,
    bottleImageCandidate,
    bottleId,
  }: BottleReferenceAssignmentResult,
  contexts?: SentryLogContexts,
) {
  await fillMissingBottleImage(bottleImageCandidate, contexts);

  if (referenceChanged) {
    try {
      await pushJob("IndexBottleReference", { name: reference.name });
    } catch (err) {
      logError(err, contexts);
    }
  }

  try {
    await pushUniqueJob("IndexBottleSearchVectors", { bottleId });
  } catch (err) {
    logError(err, contexts);
  }
}

/** Fills only a missing Bottle image and respects rejected image URLs. */
export async function fillMissingBottleImage(
  bottleImageCandidate: BottleImageCandidate | null,
  contexts?: SentryLogContexts,
) {
  if (!bottleImageCandidate) return;

  const attachImage = (targetBottleId: number) =>
    db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bottles)
        .set({ imageUrl: bottleImageCandidate.imageUrl })
        .where(
          and(
            eq(bottles.id, targetBottleId),
            or(isNull(bottles.imageUrl), eq(bottles.imageUrl, "")),
            sql`${bottleImageCandidate.imageUrl} <> ALL(${bottles.rejectedImageUrls})`,
          ),
        )
        .returning({ id: bottles.id });
      if (!updated) return false;
      await tx.insert(bottleImages).values({
        bottleId: targetBottleId,
        imageUrl: bottleImageCandidate.imageUrl,
        sourceUrl: bottleImageCandidate.sourceUrl,
        license: null,
        isPrimary: true,
        createdByActorId: bottleImageCandidate.createdByActorId,
      });
      return true;
    });

  try {
    const updatedOriginal = await attachImage(bottleImageCandidate.bottleId);
    if (updatedOriginal) return;

    const original = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottleImageCandidate.bottleId),
      columns: { id: true },
    });
    if (original) return;

    const tombstone = await db.query.bottleTombstones.findFirst({
      where: eq(bottleTombstones.bottleId, bottleImageCandidate.bottleId),
      columns: { newBottleId: true },
    });
    if (!tombstone) {
      recordUnresolvedBottleImageCandidate(
        bottleImageCandidate,
        "missing_tombstone",
      );
      return;
    }
    if (!tombstone.newBottleId) {
      recordUnresolvedBottleImageCandidate(
        bottleImageCandidate,
        "missing_replacement_mapping",
      );
      return;
    }

    const updatedReplacement = await attachImage(tombstone.newBottleId);
    if (updatedReplacement) return;

    const replacement = await db.query.bottles.findFirst({
      where: eq(bottles.id, tombstone.newBottleId),
      columns: { id: true },
    });
    if (!replacement) {
      recordUnresolvedBottleImageCandidate(
        bottleImageCandidate,
        "missing_replacement_bottle",
      );
    }
  } catch (err) {
    logError(err, {
      ...contexts,
      bottleImageCandidate,
    });
  }
}

/** Assigns one direct Bottle identity, then runs post-commit effects. */
export async function assignBottleReference(
  params: BottleReferenceAssignmentInput,
  contexts?: SentryLogContexts,
) {
  const result = await db.transaction(async (tx) =>
    assignBottleReferenceInTransaction(tx, params),
  );

  await finalizeBottleReferenceAssignment(result, contexts);

  return result;
}

export type BottleReferenceCorrectionInput = {
  referenceId: number;
  expectedBottleId: number | null;
  expectedIgnored: boolean;
  bottleId: number | null;
  ignored: boolean;
  assignedByActorId: number;
};

export type BottleReferenceCorrectionResult = {
  id: number;
  name: string;
  createdAt: Date;
  bottleId: number | null;
  ignored: boolean;
  assignmentSource: BottleReferenceAssignmentSource;
  assignedByActorId: number;
};

/** Corrects one accepted reference and only consumers that still use its old identity. */
export async function correctBottleReference(
  {
    referenceId,
    expectedBottleId,
    expectedIgnored,
    bottleId,
    ignored,
    assignedByActorId,
  }: BottleReferenceCorrectionInput,
  contexts?: SentryLogContexts,
): Promise<BottleReferenceCorrectionResult> {
  const result = await db.transaction(async (tx) => {
    if (bottleId !== null) {
      await lockActiveBottleInTransaction(tx, bottleId);
    }

    const [reference] = await tx
      .select({
        id: bottleReferences.id,
        name: bottleReferences.name,
        createdAt: bottleReferences.createdAt,
        bottleId: bottleReferences.bottleId,
        ignored: bottleReferences.ignored,
        assignmentSource: bottleReferences.assignmentSource,
        assignedByActorId: bottleReferences.assignedByActorId,
      })
      .from(bottleReferences)
      .where(eq(bottleReferences.id, referenceId))
      .limit(1)
      .for("update");
    if (!reference) {
      throw new BottleReferenceNotFoundError(referenceId);
    }

    const currentIgnored = reference.ignored === true;
    if (
      reference.bottleId !== expectedBottleId ||
      currentIgnored !== expectedIgnored
    ) {
      throw new StaleBottleReferenceCorrectionError(
        referenceId,
        expectedBottleId,
        reference.bottleId,
        expectedIgnored,
        currentIgnored,
      );
    }
    if (reference.bottleId === bottleId && currentIgnored === ignored) {
      return {
        reference: {
          id: reference.id,
          name: reference.name,
          createdAt: reference.createdAt,
          bottleId: reference.bottleId,
          ignored: currentIgnored,
          assignmentSource: reference.assignmentSource,
          assignedByActorId: reference.assignedByActorId,
        },
        previousBottleId: reference.bottleId,
        changed: false,
      };
    }

    if (reference.bottleId !== null) {
      const sourceBottle = await tx.query.bottles.findFirst({
        where: eq(bottles.id, reference.bottleId),
        columns: { fullName: true },
      });
      if (
        sourceBottle?.fullName.toLowerCase() === reference.name.toLowerCase()
      ) {
        throw new CanonicalBottleReferenceCorrectionError(referenceId);
      }
    }

    const previousBottleId = reference.bottleId;
    const lookupName = reference.name.toLowerCase();
    const priorPriceIdentity =
      previousBottleId === null
        ? isNull(storePrices.bottleId)
        : or(
            isNull(storePrices.bottleId),
            eq(storePrices.bottleId, previousBottleId),
          );
    const priorReviewIdentity =
      previousBottleId === null
        ? isNull(externalReviews.bottleId)
        : or(
            isNull(externalReviews.bottleId),
            eq(externalReviews.bottleId, previousBottleId),
          );

    await tx
      .update(storePrices)
      .set({ bottleId })
      .where(
        and(
          eq(sql`LOWER(${storePrices.name})`, lookupName),
          bottleId === null && previousBottleId !== null
            ? eq(storePrices.bottleId, previousBottleId)
            : priorPriceIdentity,
        ),
      );
    await tx
      .update(externalReviews)
      .set({ bottleId })
      .where(
        and(
          eq(sql`LOWER(${externalReviews.name})`, lookupName),
          bottleId === null && previousBottleId !== null
            ? eq(externalReviews.bottleId, previousBottleId)
            : priorReviewIdentity,
        ),
      );

    const [updatedReference] = await tx
      .update(bottleReferences)
      .set({
        bottleId,
        ignored,
        embedding: null,
        assignmentSource: "human_approved",
        assignedByActorId,
        reviewedAt: null,
        reviewedByActorId: null,
      })
      .where(eq(bottleReferences.id, reference.id))
      .returning({
        id: bottleReferences.id,
        name: bottleReferences.name,
        createdAt: bottleReferences.createdAt,
        bottleId: bottleReferences.bottleId,
        ignored: bottleReferences.ignored,
        assignmentSource: bottleReferences.assignmentSource,
        assignedByActorId: bottleReferences.assignedByActorId,
      });
    if (!updatedReference) {
      throw new FailedToSaveBottleReferenceError();
    }

    return {
      reference: {
        ...updatedReference,
        ignored: updatedReference.ignored === true,
      },
      previousBottleId,
      changed: true,
    };
  });

  if (result.changed) {
    try {
      await pushJob("IndexBottleReference", { name: result.reference.name });
    } catch (err) {
      logError(err, contexts);
    }

    for (const changedBottleId of new Set(
      [result.previousBottleId, result.reference.bottleId].filter(
        (value): value is number => value !== null,
      ),
    )) {
      try {
        await pushUniqueJob("IndexBottleSearchVectors", {
          bottleId: changedBottleId,
        });
      } catch (err) {
        logError(err, contexts);
      }
    }
  }

  return result.reference;
}
