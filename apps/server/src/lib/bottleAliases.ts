/**
 * Owns Bottle alias reservation and assignment. Exact reservation claims only
 * the alias row; full assignment also migrates matching unresolved consumers.
 */
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import type {
  BottleAlias,
  BottleAliasAssignmentSource,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleTombstones,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError, logInfo } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
  type ActiveBottleRejectionReason,
} from "@peated/server/lib/resolveActiveBottleIds";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

/** Lists unresolved, non-ignored aliases for bounded maintenance output. */
export async function listUnmatchedBottleAliasNames(
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
    .select({ name: bottleAliases.name })
    .from(bottleAliases)
    .where(
      and(
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
        isNull(bottleAliases.bottleId),
      ),
    )
    .orderBy(asc(bottleAliases.name))
    .offset(offset)
    .limit(limit);

  return rows.map(({ name }) => name);
}

export class FailedToSaveBottleAliasError extends Error {
  constructor() {
    super("Failed to save alias.");
    this.name = "FailedToSaveBottleAliasError";
  }
}

export class BottleAliasBottleNotFoundError extends Error {
  constructor(readonly bottleId: number) {
    super(`Bottle ${bottleId} was not found.`);
    this.name = "BottleAliasBottleNotFoundError";
  }
}

export class BottleAliasBottleRetiredError extends Error {
  constructor(
    readonly bottleId: number,
    readonly replacementBottleId: number | null,
  ) {
    super(
      replacementBottleId === null
        ? `Bottle ${bottleId} is retired.`
        : `Bottle ${bottleId} is retired in favor of Bottle ${replacementBottleId}.`,
    );
    this.name = "BottleAliasBottleRetiredError";
  }
}

export type BottleAliasBottleInactiveReason = Extract<
  ActiveBottleRejectionReason,
  "unassigned"
>;

export class BottleAliasBottleInactiveError extends Error {
  constructor(
    readonly bottleId: number,
    readonly reason: BottleAliasBottleInactiveReason,
  ) {
    super(
      reason === "unassigned"
        ? `Bottle ${bottleId} is not assigned to a BottleGroup.`
        : `Bottle ${bottleId} belongs to a retired BottleGroup.`,
    );
    this.name = "BottleAliasBottleInactiveError";
  }
}

export class StaleBottleAliasReviewIdentityError extends Error {
  constructor(readonly reviewId: number) {
    super(`Review ${reviewId} changed while its Bottle alias was resolving.`);
    this.name = "StaleBottleAliasReviewIdentityError";
  }
}

export type BottleAliasIdentitySnapshot = Pick<
  BottleAlias,
  "name" | "bottleId" | "ignored" | "assignmentSource" | "assignedByActorId"
>;

export class ExactBottleAliasConflictError extends Error {
  constructor(
    readonly code: "another_bottle",
    readonly alias: BottleAliasIdentitySnapshot,
    readonly conflictingBottleId: number | null,
  ) {
    super(`Cannot reserve exact Bottle alias "${alias.name}": ${code}.`);
    this.name = "ExactBottleAliasConflictError";
  }
}

export class BottleAliasIdentityChangedError extends Error {
  constructor(readonly aliasName: string) {
    super(`Bottle alias identity changed during assignment (${aliasName}).`);
    this.name = "BottleAliasIdentityChangedError";
  }
}

export type BottleAliasReviewIdentitySnapshot = Pick<
  typeof reviews.$inferSelect,
  "id" | "name" | "bottleId"
>;

export type BottleAliasAssignmentInput = {
  bottleId: number;
  externalSiteId?: number;
  name: string;
  backfillNames?: string[];
  volume?: number;
  ignored?: boolean;
  assignmentSource?: BottleAliasAssignmentSource;
  assignedByActorId: number;
  sourceAliasIdentity?: BottleAliasIdentitySnapshot;
  expectedReview?: BottleAliasReviewIdentitySnapshot;
};

export type BottleAliasAssignmentOptions = Pick<
  BottleAliasAssignmentInput,
  "assignmentSource" | "assignedByActorId"
>;

type BottleImageCandidate = {
  bottleId: number;
  imageUrl: string;
};

export type BottleAliasAssignmentResult = {
  alias: BottleAliasIdentitySnapshot;
  aliasChanged: boolean;
  isNew: boolean;
  bottleImageCandidate: BottleImageCandidate | null;
  bottleId: number;
};

type BottleAliasAssignmentValues = {
  assignmentSource?: BottleAliasAssignmentSource;
  assignedByActorId: number;
};

function getAssignmentInsertValues({
  assignmentSource = "legacy",
  assignedByActorId,
}: BottleAliasAssignmentValues) {
  return {
    assignmentSource,
    assignedByActorId,
  };
}

function getAssignmentUpdateValues(options: BottleAliasAssignmentValues) {
  return {
    ...(options.assignmentSource !== undefined
      ? { assignmentSource: options.assignmentSource }
      : {}),
    assignedByActorId: options.assignedByActorId,
  };
}

/** Rejects a stale lookup precondition against an alias locked by its caller. */
function assertBottleAliasIdentitySnapshot(
  lockedAlias: BottleAliasIdentitySnapshot | undefined,
  snapshot: BottleAliasIdentitySnapshot,
): asserts lockedAlias is BottleAliasIdentitySnapshot {
  if (
    !lockedAlias ||
    lockedAlias.name !== snapshot.name ||
    lockedAlias.bottleId !== snapshot.bottleId ||
    lockedAlias.ignored !== snapshot.ignored ||
    lockedAlias.assignmentSource !== snapshot.assignmentSource ||
    lockedAlias.assignedByActorId !== snapshot.assignedByActorId
  ) {
    throw new BottleAliasIdentityChangedError(snapshot.name);
  }
}

/** Locks a distinct source alias and rejects a stale lookup precondition. */
async function lockBottleAliasIdentitySnapshotInTransaction(
  tx: AnyTransaction,
  snapshot: BottleAliasIdentitySnapshot,
): Promise<void> {
  const [lockedAlias] = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      ignored: bottleAliases.ignored,
      assignmentSource: bottleAliases.assignmentSource,
      assignedByActorId: bottleAliases.assignedByActorId,
    })
    .from(bottleAliases)
    .where(eq(bottleAliases.name, snapshot.name))
    .limit(1)
    .for("update");
  assertBottleAliasIdentitySnapshot(lockedAlias, snapshot);
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
      throw new BottleAliasBottleNotFoundError(error.bottleId);
    }
    if (error.reason === "bottle_retired") {
      throw new BottleAliasBottleRetiredError(
        error.bottleId,
        error.replacementBottleId,
      );
    }
    throw new BottleAliasBottleInactiveError(error.bottleId, error.reason);
  }
}

export type ExactBottleAliasReservationInput = {
  name: string;
  bottleId: number;
  assignmentSource: BottleAliasAssignmentSource;
  assignedByActorId: number;
};

type ExactBottleAliasClaimResult = {
  alias: BottleAliasIdentitySnapshot;
  inserted: boolean;
  changed: boolean;
};

/** Claims one runtime alias identity without reading or writing legacy evidence. */
async function claimBottleAliasNameInTransaction(
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
    expectedIdentity?: BottleAliasIdentitySnapshot;
    ignored?: boolean;
    assignmentSource?: BottleAliasAssignmentSource;
    assignedByActorId: number;
    reservation: boolean;
  },
): Promise<ExactBottleAliasClaimResult> {
  if (!name.trim()) {
    throw new FailedToSaveBottleAliasError();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [existingAlias] = await tx
      .select({
        name: bottleAliases.name,
        bottleId: bottleAliases.bottleId,
        ignored: bottleAliases.ignored,
        assignmentSource: bottleAliases.assignmentSource,
        assignedByActorId: bottleAliases.assignedByActorId,
      })
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
      .limit(1)
      .for("update");

    if (expectedIdentity) {
      assertBottleAliasIdentitySnapshot(existingAlias, expectedIdentity);
    }

    if (!existingAlias) {
      const [insertedAlias] = await tx
        .insert(bottleAliases)
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
          name: bottleAliases.name,
          bottleId: bottleAliases.bottleId,
          ignored: bottleAliases.ignored,
          assignmentSource: bottleAliases.assignmentSource,
          assignedByActorId: bottleAliases.assignedByActorId,
        });
      if (insertedAlias) {
        return {
          alias: insertedAlias,
          inserted: true,
          changed: true,
        };
      }
      continue;
    }

    if (
      existingAlias.bottleId !== null &&
      existingAlias.bottleId !== bottleId
    ) {
      throw new ExactBottleAliasConflictError(
        "another_bottle",
        existingAlias,
        existingAlias.bottleId,
      );
    }

    const assignmentValues = getAssignmentUpdateValues({
      assignmentSource,
      assignedByActorId,
    });
    const nextIgnored =
      reservation || existingAlias.bottleId === null
        ? (ignored ?? false)
        : existingAlias.ignored;
    const nextAssignmentSource =
      assignmentSource ?? existingAlias.assignmentSource;
    const unchanged =
      existingAlias.name === name &&
      existingAlias.bottleId === bottleId &&
      existingAlias.ignored === nextIgnored &&
      existingAlias.assignmentSource === nextAssignmentSource &&
      existingAlias.assignedByActorId === assignedByActorId;
    if (unchanged) {
      return {
        alias: existingAlias,
        inserted: false,
        changed: false,
      };
    }

    const [updatedAlias] = await tx
      .update(bottleAliases)
      .set({
        name,
        bottleId,
        ignored: nextIgnored,
        embedding: null,
        ...assignmentValues,
      })
      .where(eq(bottleAliases.name, existingAlias.name))
      .returning({
        name: bottleAliases.name,
        bottleId: bottleAliases.bottleId,
        ignored: bottleAliases.ignored,
        assignmentSource: bottleAliases.assignmentSource,
        assignedByActorId: bottleAliases.assignedByActorId,
      });
    if (updatedAlias) {
      return {
        alias: updatedAlias,
        inserted: false,
        changed: true,
      };
    }
  }

  throw new FailedToSaveBottleAliasError();
}

async function reserveExactBottleAliasNameInTransaction(
  tx: AnyTransaction,
  input: ExactBottleAliasReservationInput,
): Promise<{ name: string; changed: boolean }> {
  await lockActiveBottleInTransaction(tx, input.bottleId);
  const result = await claimBottleAliasNameInTransaction(tx, {
    ...input,
    reservation: true,
  });
  return { name: result.alias.name, changed: result.changed };
}

/** Reserves the literal trimmed canonical name already persisted on a Bottle. */
export async function reserveLiteralCanonicalBottleAliasInTransaction(
  tx: AnyTransaction,
  input: ExactBottleAliasReservationInput,
): Promise<{ name: string; changed: boolean }> {
  return reserveExactBottleAliasNameInTransaction(tx, {
    ...input,
    name: input.name.trim(),
  });
}

/** Reserves a normalized canonical alias without migrating other references. */
export async function reserveExactBottleAliasInTransaction(
  tx: AnyTransaction,
  input: ExactBottleAliasReservationInput,
): Promise<{ name: string; changed: boolean }> {
  return reserveExactBottleAliasNameInTransaction(tx, {
    ...input,
    name: normalizeBottleAliasKey(input.name),
  });
}

async function assertExpectedReviewIdentity(
  tx: AnyTransaction,
  expectedReview: BottleAliasReviewIdentitySnapshot,
) {
  const [lockedReview] = await tx
    .select({
      id: reviews.id,
      name: reviews.name,
      bottleId: reviews.bottleId,
    })
    .from(reviews)
    .where(eq(reviews.id, expectedReview.id))
    .limit(1)
    .for("update");
  if (
    !lockedReview ||
    lockedReview.name !== expectedReview.name ||
    lockedReview.bottleId !== expectedReview.bottleId
  ) {
    throw new StaleBottleAliasReviewIdentityError(expectedReview.id);
  }
}

/**
 * Applies one Bottle id to matching unresolved consumers. Already-resolved rows
 * are changed only when they still match the selected Bottle or an explicit
 * review snapshot proves the caller observed the identity being replaced.
 */
async function syncBottleAliasConsumersInTransaction(
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
    expectedReview?: BottleAliasReviewIdentitySnapshot;
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
    .returning({ imageUrl: storePrices.imageUrl });

  const reviewIdentity = or(
    isNull(reviews.bottleId),
    eq(reviews.bottleId, bottleId),
    expectedReview ? eq(reviews.id, expectedReview.id) : undefined,
  );
  await tx
    .update(reviews)
    .set({ bottleId })
    .where(
      and(
        or(
          ...lookupNames.map((value) => eq(sql`LOWER(${reviews.name})`, value)),
        ),
        externalSiteId !== undefined
          ? eq(reviews.externalSiteId, externalSiteId)
          : undefined,
        reviewIdentity,
      ),
    );

  const priceWithImage = matchingPrices.find((price) => !!price.imageUrl);
  return {
    bottleImageCandidate: priceWithImage?.imageUrl
      ? { bottleId, imageUrl: priceWithImage.imageUrl }
      : null,
  };
}

/** Assigns an alias and matching consumers to one independently complete Bottle. */
export async function assignBottleAliasInTransaction(
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
    sourceAliasIdentity,
    expectedReview,
  }: BottleAliasAssignmentInput,
): Promise<BottleAliasAssignmentResult> {
  if (!name.trim()) {
    throw new FailedToSaveBottleAliasError();
  }

  await lockActiveBottleInTransaction(tx, bottleId);
  const lookupNames = Array.from(
    new Set(
      [name, ...backfillNames].map((value) => value.trim().toLowerCase()),
    ),
  ).filter(Boolean);
  const { bottleImageCandidate } = await syncBottleAliasConsumersInTransaction(
    tx,
    {
      bottleId,
      externalSiteId,
      lookupNames,
      volume,
      expectedReview,
    },
  );

  const sourceIsCanonicalName =
    sourceAliasIdentity?.name.toLowerCase() === name.toLowerCase();
  const claim = await claimBottleAliasNameInTransaction(tx, {
    name,
    bottleId,
    ignored,
    assignmentSource,
    assignedByActorId,
    reservation: false,
    ...(sourceAliasIdentity && sourceIsCanonicalName
      ? { expectedIdentity: sourceAliasIdentity }
      : {}),
  });
  if (sourceAliasIdentity && !sourceIsCanonicalName) {
    await lockBottleAliasIdentitySnapshotInTransaction(tx, sourceAliasIdentity);
  }

  return {
    alias: claim.alias,
    aliasChanged: claim.changed,
    isNew: claim.inserted,
    bottleImageCandidate,
    bottleId,
  };
}

/** Replays one assigned alias directly to eligible consumers. */
export async function syncBottleAliasConsumersForAliasChange(name: string) {
  await db.transaction(async (tx) => {
    const [alias] = await tx
      .select({
        name: bottleAliases.name,
        bottleId: bottleAliases.bottleId,
        ignored: bottleAliases.ignored,
        assignmentSource: bottleAliases.assignmentSource,
        assignedByActorId: bottleAliases.assignedByActorId,
      })
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
      .limit(1);
    if (!alias) {
      throw new Error(`Unknown bottle alias: ${name}`);
    }
    if (alias.ignored || alias.bottleId === null) return;

    try {
      await lockActiveBottleInTransaction(tx, alias.bottleId);
    } catch (error) {
      if (
        error instanceof BottleAliasBottleNotFoundError ||
        error instanceof BottleAliasBottleRetiredError ||
        error instanceof BottleAliasBottleInactiveError
      ) {
        return;
      }
      throw error;
    }
    await syncBottleAliasConsumersInTransaction(tx, {
      bottleId: alias.bottleId,
      lookupNames: [alias.name.toLowerCase()],
    });

    const [unchangedAlias] = await tx
      .select({ name: bottleAliases.name })
      .from(bottleAliases)
      .where(
        and(
          eq(bottleAliases.name, alias.name),
          sql`${bottleAliases.bottleId} IS NOT DISTINCT FROM ${alias.bottleId}`,
          sql`${bottleAliases.ignored} IS NOT DISTINCT FROM ${alias.ignored}`,
          sql`${bottleAliases.assignmentSource} IS NOT DISTINCT FROM ${alias.assignmentSource}`,
          sql`${bottleAliases.assignedByActorId} IS NOT DISTINCT FROM ${alias.assignedByActorId}`,
        ),
      )
      .limit(1)
      .for("update");
    if (!unchangedAlias) {
      throw new BottleAliasIdentityChangedError(alias.name);
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
  logInfo("Unable to apply Bottle alias image candidate", {
    extra: {
      event: "bottle_alias.image_candidate_unresolved",
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
export async function finalizeBottleAliasAssignment(
  {
    alias,
    aliasChanged,
    bottleImageCandidate,
    bottleId,
  }: BottleAliasAssignmentResult,
  contexts?: Record<string, Record<string, any>>,
) {
  if (bottleImageCandidate) {
    try {
      const [updatedOriginal] = await db
        .update(bottles)
        .set({ imageUrl: bottleImageCandidate.imageUrl })
        .where(
          and(
            eq(bottles.id, bottleImageCandidate.bottleId),
            or(isNull(bottles.imageUrl), eq(bottles.imageUrl, "")),
          ),
        )
        .returning({ id: bottles.id });
      if (!updatedOriginal) {
        const original = await db.query.bottles.findFirst({
          where: eq(bottles.id, bottleImageCandidate.bottleId),
          columns: { id: true },
        });
        if (!original) {
          const tombstone = await db.query.bottleTombstones.findFirst({
            where: eq(bottleTombstones.bottleId, bottleImageCandidate.bottleId),
            columns: { newBottleId: true },
          });
          if (!tombstone) {
            recordUnresolvedBottleImageCandidate(
              bottleImageCandidate,
              "missing_tombstone",
            );
          } else if (tombstone.newBottleId) {
            const [updatedReplacement] = await db
              .update(bottles)
              .set({ imageUrl: bottleImageCandidate.imageUrl })
              .where(
                and(
                  eq(bottles.id, tombstone.newBottleId),
                  or(isNull(bottles.imageUrl), eq(bottles.imageUrl, "")),
                ),
              )
              .returning({ id: bottles.id });
            if (!updatedReplacement) {
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
            }
          } else {
            recordUnresolvedBottleImageCandidate(
              bottleImageCandidate,
              "missing_replacement_mapping",
            );
          }
        }
      }
    } catch (err) {
      logError(err, {
        ...contexts,
        bottleImageCandidate,
      });
    }
  }

  if (aliasChanged) {
    try {
      await pushJob("IndexBottleAlias", { name: alias.name });
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

/** Assigns one direct Bottle identity, then runs post-commit effects. */
export async function assignBottleAlias(
  params: BottleAliasAssignmentInput,
  contexts?: Record<string, Record<string, any>>,
) {
  const result = await db.transaction(async (tx) =>
    assignBottleAliasInTransaction(tx, params),
  );

  await finalizeBottleAliasAssignment(result, contexts);

  return result;
}
