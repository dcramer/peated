/**
 * Owns Bottle alias reservation and assignment. Exact reservation claims only
 * the alias row; full assignment also migrates matching stored references.
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
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  resolveCatalogTargetForAssignment,
  type CatalogTargetOperationContext,
} from "@peated/server/lib/catalogTargets";
import { logError, logInfo } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

export class DuplicateBottleAliasError extends Error {
  constructor(readonly bottleId: number) {
    super(`Duplicate alias found (${bottleId}). Not implemented.`);
    this.name = "DuplicateBottleAliasError";
  }
}

export class FailedToSaveBottleAliasError extends Error {
  constructor() {
    super("Failed to save alias.");
    this.name = "FailedToSaveBottleAliasError";
  }
}

export type InvalidExactBottleAliasTargetCode =
  | "generic_target"
  | "bottle_mismatch"
  | "legacy_release";

export class InvalidExactBottleAliasTargetError extends Error {
  constructor(
    readonly code: InvalidExactBottleAliasTargetCode,
    readonly targetId: number,
    readonly bottleId: number,
  ) {
    super(
      `Invalid exact Bottle alias target (${targetId}, ${bottleId}): ${code}.`,
    );
    this.name = "InvalidExactBottleAliasTargetError";
  }
}

export type ExactBottleAliasConflictCode =
  | "another_bottle"
  | "another_exact_target"
  | "generic_target"
  | "legacy_release";

export class ExactBottleAliasConflictError extends Error {
  constructor(
    readonly code: ExactBottleAliasConflictCode,
    readonly alias: Pick<
      BottleAlias,
      "name" | "bottleId" | "releaseId" | "targetId"
    >,
    readonly conflictingBottleId: number | null,
  ) {
    super(`Cannot reserve exact Bottle alias "${alias.name}": ${code}.`);
    this.name = "ExactBottleAliasConflictError";
  }
}

export type BottleAliasAssignmentOptions = {
  assignmentSource?: BottleAliasAssignmentSource;
  assignedByActorId: number;
};

type BottleAliasAssignmentInput = {
  bottleId: number;
  releaseId?: number | null;
  aliasReleaseId?: number | null;
  externalSiteId?: number;
  name: string;
  backfillNames?: string[];
  volume?: number;
  ignored?: boolean;
} & BottleAliasAssignmentOptions &
  (
    | { targetId: number; context?: never }
    | {
        targetId?: null;
        context: CatalogTargetOperationContext;
      }
  );

export type BottleAliasAssignmentResult = {
  alias: BottleAlias;
  isNew: boolean;
  bottleImageCandidate: BottleImageCandidate | null;
};

type BottleImageCandidate = {
  bottleId: number;
  imageUrl: string;
};

type BottleAliasConsumerBackfillResult = {
  bottleImageCandidate: BottleImageCandidate | null;
  reviewIds: number[];
};

type BottleAliasAssignmentValues = {
  assignmentSource?: BottleAliasAssignmentSource;
  assignedByActorId: number;
};

function hasExplicitAssignmentOptions(options: BottleAliasAssignmentValues) {
  return options.assignmentSource !== undefined;
}

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

async function validateExactBottleAliasTarget(
  tx: AnyTransaction,
  { bottleId, targetId }: { bottleId: number; targetId: number },
) {
  // Match concrete merge ordering so active/integrity resolution occurs at a
  // serialization point where a later merge must repoint this alias.
  await tx
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1)
    .for("update");
  await tx
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(eq(catalogTargets.id, targetId))
    .limit(1)
    .for("update");

  const target = await resolveCatalogTargetForAssignment(
    { kind: "target", targetId },
    tx,
  );
  if (target.bottleId === null) {
    throw new InvalidExactBottleAliasTargetError(
      "generic_target",
      targetId,
      bottleId,
    );
  }
  if (target.bottleId !== bottleId) {
    throw new InvalidExactBottleAliasTargetError(
      "bottle_mismatch",
      targetId,
      bottleId,
    );
  }
}

function recordTargetlessBottleAliasCompatibility({
  bottleId,
  context,
  releaseId,
  name,
}: {
  bottleId: number;
  context: CatalogTargetOperationContext;
  releaseId: number | null;
  name: string;
}) {
  logInfo("Legacy targetless Bottle alias assignment", {
    extra: {
      event: "bottle_alias.compatibility",
      access: "write",
      caller: context.caller,
      operation: context.operation,
      bottleId,
      releaseId,
      name,
    },
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

function requireBottleAliasCompatibilityContext(
  context: CatalogTargetOperationContext | undefined,
): CatalogTargetOperationContext {
  if (!context?.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Bottle alias compatibility context requires caller and operation.",
    );
  }
  return context;
}

async function getExactBottleAliasConflict(
  tx: AnyDatabase,
  alias: BottleAlias,
  { bottleId, targetId }: { bottleId: number; targetId: number },
): Promise<{
  code: ExactBottleAliasConflictCode;
  conflictingBottleId: number | null;
} | null> {
  if (alias.releaseId !== null) {
    return {
      code: "legacy_release",
      conflictingBottleId: alias.bottleId,
    };
  }

  if (alias.targetId !== null && alias.targetId !== targetId) {
    const [existingTarget] = await tx
      .select({ bottleId: catalogTargets.bottleId })
      .from(catalogTargets)
      .where(eq(catalogTargets.id, alias.targetId))
      .limit(1);

    return existingTarget?.bottleId === null
      ? { code: "generic_target", conflictingBottleId: null }
      : {
          code: "another_exact_target",
          conflictingBottleId: existingTarget?.bottleId ?? null,
        };
  }

  if (alias.bottleId !== null && alias.bottleId !== bottleId) {
    return {
      code: "another_bottle",
      conflictingBottleId: alias.bottleId,
    };
  }

  return null;
}

export type ExactBottleAliasBeforeSnapshot = Pick<
  BottleAlias,
  | "name"
  | "bottleId"
  | "releaseId"
  | "targetId"
  | "ignored"
  | "assignmentSource"
  | "assignedByActorId"
  | "createdAt"
>;

export type ExactBottleAliasReservationWithPreimage =
  | { name: string; changed: false }
  | {
      name: string;
      changed: true;
      before: ExactBottleAliasBeforeSnapshot | null;
    };

type ExactBottleAliasReservationInput = {
  name: string;
  bottleId: number;
  targetId: number;
  assignmentSource: BottleAliasAssignmentSource;
  assignedByActorId: number;
};

type ExactBottleAliasClaimIntent =
  | {
      kind: "reservation";
      assignmentSource: BottleAliasAssignmentSource;
      assignedByActorId: number;
    }
  | {
      kind: "assignment";
      assignmentSource?: BottleAliasAssignmentSource;
      assignedByActorId: number;
      ignored?: boolean;
    };

type ExactBottleAliasClaimResult = {
  alias: BottleAlias;
  inserted: boolean;
  changed: boolean;
  before: ExactBottleAliasBeforeSnapshot | null;
};

function exactBottleAliasBeforeSnapshot(
  alias: BottleAlias,
): ExactBottleAliasBeforeSnapshot {
  return {
    name: alias.name,
    bottleId: alias.bottleId,
    releaseId: alias.releaseId,
    targetId: alias.targetId,
    ignored: alias.ignored,
    assignmentSource: alias.assignmentSource,
    assignedByActorId: alias.assignedByActorId,
    createdAt: alias.createdAt,
  };
}

/** Locks and claims one exact alias for both reservation and full assignment. */
async function claimExactBottleAliasNameInTransaction(
  tx: AnyTransaction,
  {
    name: aliasName,
    bottleId,
    targetId,
  }: Pick<ExactBottleAliasReservationInput, "name" | "bottleId" | "targetId">,
  intent: ExactBottleAliasClaimIntent,
): Promise<ExactBottleAliasClaimResult> {
  if (!aliasName) {
    throw new FailedToSaveBottleAliasError();
  }

  // `ignored` applies only to inserts/unbound claims; existing assigned aliases
  // preserve moderator active/ignored state.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [existingAlias] = await tx
      .select()
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
      .limit(1)
      .for("update");

    if (!existingAlias) {
      const assignmentValues =
        intent.kind === "reservation"
          ? {
              assignmentSource: intent.assignmentSource,
              assignedByActorId: intent.assignedByActorId,
            }
          : getAssignmentInsertValues(intent);
      const [insertedAlias] = await tx
        .insert(bottleAliases)
        .values({
          name: aliasName,
          bottleId,
          releaseId: null,
          targetId,
          ...(intent.kind === "reservation"
            ? { ignored: false }
            : intent.ignored !== undefined
              ? { ignored: intent.ignored }
              : {}),
          ...assignmentValues,
        })
        .onConflictDoNothing()
        .returning();
      if (insertedAlias) {
        return {
          alias: insertedAlias,
          inserted: true,
          changed: true,
          before: null,
        };
      }
      // A concurrent insert may win the unique name; re-read it once.
      continue;
    }

    const conflict = await getExactBottleAliasConflict(tx, existingAlias, {
      bottleId,
      targetId,
    });
    if (conflict) {
      throw new ExactBottleAliasConflictError(
        conflict.code,
        existingAlias,
        conflict.conflictingBottleId,
      );
    }

    if (
      existingAlias.bottleId === bottleId &&
      existingAlias.targetId === targetId
    ) {
      if (intent.kind === "reservation") {
        return {
          alias: existingAlias,
          inserted: false,
          changed: false,
          before: null,
        };
      }

      const assignmentUpdateValues = getAssignmentUpdateValues(intent);
      if (
        existingAlias.name === aliasName &&
        !hasExplicitAssignmentOptions(intent) &&
        existingAlias.assignedByActorId === intent.assignedByActorId
      ) {
        return {
          alias: existingAlias,
          inserted: false,
          changed: false,
          before: null,
        };
      }

      const [updatedAlias] = await tx
        .update(bottleAliases)
        .set({ name: aliasName, ...assignmentUpdateValues })
        .where(eq(bottleAliases.name, existingAlias.name))
        .returning();
      if (!updatedAlias) break;
      return {
        alias: updatedAlias,
        inserted: false,
        changed: true,
        before: exactBottleAliasBeforeSnapshot(existingAlias),
      };
    }

    const assignmentValues =
      intent.kind === "reservation"
        ? {
            assignmentSource: intent.assignmentSource,
            assignedByActorId: intent.assignedByActorId,
          }
        : getAssignmentUpdateValues(intent);
    const [claimedAlias] = await tx
      .update(bottleAliases)
      .set({
        name: aliasName,
        bottleId,
        releaseId: null,
        targetId,
        ...(intent.kind === "reservation"
          ? { ignored: false }
          : existingAlias.bottleId === null && intent.ignored !== undefined
            ? { ignored: intent.ignored }
            : {}),
        ...assignmentValues,
      })
      .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
      .returning();
    if (claimedAlias) {
      return {
        alias: claimedAlias,
        inserted: false,
        changed: true,
        before: exactBottleAliasBeforeSnapshot(existingAlias),
      };
    }
  }

  throw new FailedToSaveBottleAliasError();
}

/**
 * Owns durable exact-alias reservation, returns its reversal preimage, and
 * retries once when a concurrent unique-name insert wins.
 */
async function reserveExactBottleAliasNameInTransaction(
  tx: AnyTransaction,
  input: ExactBottleAliasReservationInput,
): Promise<ExactBottleAliasReservationWithPreimage> {
  const result = await claimExactBottleAliasNameInTransaction(tx, input, {
    kind: "reservation",
    assignmentSource: input.assignmentSource,
    assignedByActorId: input.assignedByActorId,
  });
  return result.changed
    ? { name: result.alias.name, changed: true, before: result.before }
    : { name: result.alias.name, changed: false };
}

/** Reserves a normalized canonical alias without migrating other references. */
export async function reserveExactBottleAliasWithPreimageInTransaction(
  tx: AnyTransaction,
  input: ExactBottleAliasReservationInput,
): Promise<ExactBottleAliasReservationWithPreimage> {
  return reserveExactBottleAliasNameInTransaction(tx, {
    ...input,
    name: normalizeBottleAliasKey(input.name),
  });
}

/** Reserves the literal trimmed canonical name already persisted on a Bottle. */
export async function reserveLiteralCanonicalBottleAliasInTransaction(
  tx: AnyTransaction,
  input: ExactBottleAliasReservationInput,
): Promise<ExactBottleAliasReservationWithPreimage> {
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
  const result = await reserveExactBottleAliasWithPreimageInTransaction(
    tx,
    input,
  );
  return { name: result.name, changed: result.changed };
}

/**
 * Updates matching StorePrice then Review consumers before alias locking, and
 * returns an image candidate plus updated Review IDs for post-lock correction.
 */
async function backfillBottleAliasConsumersInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    releaseId,
    reviewReleaseId,
    externalSiteId,
    lookupNames,
    volume,
  }: {
    bottleId: number;
    releaseId: number | null;
    reviewReleaseId: number | null;
    externalSiteId?: number;
    lookupNames: string[];
    volume?: number;
  },
): Promise<BottleAliasConsumerBackfillResult> {
  const matchingPrices = await tx
    .update(storePrices)
    .set({ bottleId, releaseId })
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
      ),
    )
    .returning({ imageUrl: storePrices.imageUrl });

  const reviewIds = await updateBottleAliasReviewsInTransaction(tx, {
    bottleId,
    releaseId: reviewReleaseId,
    externalSiteId,
    lookupNames,
  });

  const priceWithImage = matchingPrices.find((price) => !!price.imageUrl);
  return {
    bottleImageCandidate: priceWithImage?.imageUrl
      ? { bottleId, imageUrl: priceWithImage.imageUrl }
      : null,
    reviewIds,
  };
}

async function updateBottleAliasReviewsInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    releaseId,
    externalSiteId,
    lookupNames,
  }: {
    bottleId: number;
    releaseId: number | null;
    externalSiteId?: number;
    lookupNames: string[];
  },
) {
  const matchingReviews = await tx
    .update(reviews)
    .set({ bottleId, releaseId })
    .where(
      and(
        or(
          ...lookupNames.map((value) => eq(sql`LOWER(${reviews.name})`, value)),
        ),
        externalSiteId !== undefined
          ? eq(reviews.externalSiteId, externalSiteId)
          : undefined,
      ),
    )
    .returning({ id: reviews.id });
  return matchingReviews.map(({ id }) => id);
}

function getNextTargetlessAliasReleaseId(
  alias: BottleAlias | undefined,
  aliasReleaseId: number | null,
) {
  return alias?.targetId !== null && alias?.targetId !== undefined
    ? alias.releaseId
    : aliasReleaseId === null
      ? (alias?.releaseId ?? null)
      : aliasReleaseId;
}

/**
 * Assigns an alias inside an existing transaction and records its provenance.
 * Exact mode validates and persists `targetId`; omitted targets retain measured
 * targetless compatibility for legacy callers without downgrading an existing
 * target-aware alias. `backfillNames` identify stored references to repair.
 */
export async function assignBottleAliasInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    targetId = null,
    releaseId = null,
    aliasReleaseId = releaseId,
    externalSiteId,
    name,
    backfillNames = [],
    volume,
    ignored,
    assignmentSource,
    assignedByActorId,
    context,
  }: BottleAliasAssignmentInput,
): Promise<BottleAliasAssignmentResult> {
  if (!name.trim()) {
    throw new FailedToSaveBottleAliasError();
  }

  const compatibilityContext =
    targetId === null ? requireBottleAliasCompatibilityContext(context) : null;

  if (targetId !== null) {
    await validateExactBottleAliasTarget(tx, { bottleId, targetId });
    if (aliasReleaseId !== null) {
      throw new InvalidExactBottleAliasTargetError(
        "legacy_release",
        targetId,
        bottleId,
      );
    }
  }

  const assignmentOptions: BottleAliasAssignmentValues = {
    assignmentSource,
    assignedByActorId,
  };
  const consumerLookupNames = Array.from(
    new Set(
      [name, ...backfillNames].map((value) => value.trim().toLowerCase()),
    ),
  ).filter(Boolean);

  let alias: BottleAlias | undefined;
  let isNew = false;
  let nextAliasReleaseId: number | null = null;
  let bottleImageCandidate: BottleImageCandidate | null = null;

  if (targetId !== null) {
    // Exact mode holds merge-compatible identity locks, then consumers, and
    // only then the alias so ingestion never waits on an alias we already hold.
    nextAliasReleaseId = null;
    ({ bottleImageCandidate } = await backfillBottleAliasConsumersInTransaction(
      tx,
      {
        bottleId,
        releaseId,
        reviewReleaseId: releaseId,
        externalSiteId,
        lookupNames: consumerLookupNames,
        volume,
      },
    ));
    const claim = await claimExactBottleAliasNameInTransaction(
      tx,
      { name, bottleId, targetId },
      {
        kind: "assignment",
        assignmentSource,
        assignedByActorId,
        ignored,
      },
    );
    alias = claim.alias;
    isNew = claim.inserted;
  } else {
    // Compatibility mode updates consumers first. The unlocked pre-read only
    // chooses a provisional Review release; the locked re-read is authoritative.
    const [provisionalAlias] = await tx
      .select()
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
      .limit(1);
    const provisionalReviewReleaseId =
      releaseId ??
      getNextTargetlessAliasReleaseId(provisionalAlias, aliasReleaseId);
    const consumerBackfill = await backfillBottleAliasConsumersInTransaction(
      tx,
      {
        bottleId,
        releaseId,
        reviewReleaseId: provisionalReviewReleaseId,
        externalSiteId,
        lookupNames: consumerLookupNames,
        volume,
      },
    );
    bottleImageCandidate = consumerBackfill.bottleImageCandidate;

    for (let attempt = 0; attempt < 2 && !alias; attempt += 1) {
      const [existingAlias] = await tx
        .select()
        .from(bottleAliases)
        .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
        .limit(1)
        .for("update");
      nextAliasReleaseId = getNextTargetlessAliasReleaseId(
        existingAlias,
        aliasReleaseId,
      );

      if (
        existingAlias?.targetId !== null &&
        existingAlias?.targetId !== undefined
      ) {
        const [existingTarget] = await tx
          .select({ bottleId: catalogTargets.bottleId })
          .from(catalogTargets)
          .where(eq(catalogTargets.id, existingAlias.targetId))
          .limit(1);
        if (existingTarget?.bottleId !== bottleId) {
          throw new ExactBottleAliasConflictError(
            existingTarget?.bottleId === null
              ? "generic_target"
              : "another_exact_target",
            existingAlias,
            existingTarget?.bottleId ?? existingAlias.bottleId,
          );
        }

        // Compatibility callers may fill the legacy Bottle projection, but the
        // target-aware writer retains the durable assignment metadata.
        if (existingAlias.bottleId === null) {
          [alias] = await tx
            .update(bottleAliases)
            .set({ bottleId })
            .where(eq(bottleAliases.name, existingAlias.name))
            .returning();
        } else if (existingAlias.bottleId === bottleId) {
          alias = existingAlias;
        } else {
          throw new DuplicateBottleAliasError(existingAlias.bottleId);
        }
        continue;
      }

      const hasMatchingBottle = existingAlias?.bottleId === bottleId;
      const hasMatchingRelease =
        existingAlias?.releaseId === aliasReleaseId ||
        existingAlias?.releaseId === null ||
        aliasReleaseId === null;
      const ignoredSet = ignored !== undefined ? { ignored } : {};

      if (hasMatchingBottle && hasMatchingRelease) {
        const assignmentUpdateValues =
          getAssignmentUpdateValues(assignmentOptions);
        if (
          existingAlias.name !== name ||
          (existingAlias.releaseId ?? null) !== nextAliasReleaseId ||
          hasExplicitAssignmentOptions(assignmentOptions) ||
          existingAlias.assignedByActorId !==
            assignmentOptions.assignedByActorId
        ) {
          [alias] = await tx
            .update(bottleAliases)
            .set({
              name,
              releaseId: nextAliasReleaseId,
              ...assignmentUpdateValues,
            })
            .where(eq(bottleAliases.name, existingAlias.name))
            .returning();
        } else {
          alias = existingAlias;
        }
      } else if (!existingAlias) {
        [alias] = await tx
          .insert(bottleAliases)
          .values({
            name,
            bottleId,
            releaseId: aliasReleaseId,
            targetId: null,
            ...ignoredSet,
            ...getAssignmentInsertValues(assignmentOptions),
          })
          .onConflictDoNothing()
          .returning();
        isNew = !!alias;
      } else if (!existingAlias.bottleId) {
        [alias] = await tx
          .update(bottleAliases)
          .set({
            bottleId,
            releaseId: aliasReleaseId,
            ...ignoredSet,
            ...getAssignmentInsertValues(assignmentOptions),
          })
          .where(eq(bottleAliases.name, existingAlias.name))
          .returning();
      } else {
        throw new DuplicateBottleAliasError(existingAlias.bottleId);
      }
    }

    if (!alias) {
      throw new FailedToSaveBottleAliasError();
    }
    const actualReviewReleaseId = releaseId ?? nextAliasReleaseId;
    if (
      actualReviewReleaseId !== provisionalReviewReleaseId &&
      consumerBackfill.reviewIds.length
    ) {
      await tx
        .update(reviews)
        .set({ bottleId, releaseId: actualReviewReleaseId })
        .where(inArray(reviews.id, consumerBackfill.reviewIds));
    }
  }

  if (!alias) {
    throw new FailedToSaveBottleAliasError();
  }

  if (compatibilityContext) {
    recordTargetlessBottleAliasCompatibility({
      bottleId,
      context: compatibilityContext,
      releaseId: alias.releaseId,
      name: alias.name,
    });
  }

  return {
    alias,
    isNew,
    bottleImageCandidate,
  };
}

/**
 * Runs after commit, fills only missing Bottle images (following a merged
 * source through its tombstone), and logs image/index/notification failures as
 * nonfatal side effects.
 */
export async function finalizeBottleAliasAssignment(
  { alias, isNew, bottleImageCandidate }: BottleAliasAssignmentResult,
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

  if (isNew) {
    try {
      await pushJob("OnBottleAliasChange", { name: alias.name });
    } catch (err) {
      logError(err, contexts);
    }
  }

  if (alias.bottleId) {
    try {
      await pushUniqueJob("IndexBottleSearchVectors", {
        bottleId: alias.bottleId,
      });
    } catch (err) {
      logError(err, contexts);
    }
  }
}

/**
 * Assigns an alias and runs its post-commit image, indexing, and notification
 * side effects. Provenance options are forwarded to the transaction.
 */
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
