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
  bottleReleases,
  bottleTombstones,
  bottles,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetInvalidMappingError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
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

type BottleAliasAssignmentCommonInput = {
  externalSiteId?: number;
  name: string;
  backfillNames?: string[];
  volume?: number;
  ignored?: boolean;
  sourceAliasIdentity?: BottleAliasIdentitySnapshot;
};

export type BottleAliasIdentitySnapshot = Pick<
  BottleAlias,
  "name" | "bottleId" | "releaseId" | "targetId" | "ignored"
>;

type BottleAliasConsumerIdentity =
  | { bottleId: number; releaseId: number | null }
  | { bottleId: null; releaseId: null };

type BottleAliasAssignmentInput = BottleAliasAssignmentCommonInput &
  BottleAliasAssignmentOptions &
  (
    | {
        target: CatalogTargetAssignmentDescriptor;
        consumerIdentity: BottleAliasConsumerIdentity;
        bottleId?: never;
        releaseId?: never;
        targetId?: never;
        context?: never;
      }
    | {
        target?: never;
        consumerIdentity?: never;
        bottleId: number;
        releaseId?: null;
        aliasReleaseId?: null;
        targetId: number;
        context?: never;
      }
    | {
        target?: never;
        consumerIdentity?: never;
        bottleId: number;
        releaseId?: number | null;
        aliasReleaseId?: number | null;
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

/** Rejects a stale lookup precondition against an alias locked by its caller. */
function assertBottleAliasIdentitySnapshot(
  lockedAlias: BottleAliasIdentitySnapshot | undefined,
  snapshot: BottleAliasIdentitySnapshot,
): void {
  if (
    !lockedAlias ||
    lockedAlias.name !== snapshot.name ||
    lockedAlias.bottleId !== snapshot.bottleId ||
    lockedAlias.releaseId !== snapshot.releaseId ||
    lockedAlias.targetId !== snapshot.targetId ||
    lockedAlias.ignored !== snapshot.ignored
  ) {
    throw new Error(
      `Bottle alias identity changed during assignment (${snapshot.name}).`,
    );
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
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(eq(bottleAliases.name, snapshot.name))
    .limit(1)
    .for("update");
  assertBottleAliasIdentitySnapshot(lockedAlias, snapshot);
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
  {
    bottleId,
    targetId,
    legacyIdentity,
  }: {
    bottleId: number | null;
    targetId: number;
    legacyIdentity?: { bottleId: number; releaseId: number | null };
  },
): Promise<{
  code: ExactBottleAliasConflictCode;
  conflictingBottleId: number | null;
} | null> {
  const matchesLegacyIdentity =
    legacyIdentity !== undefined &&
    alias.bottleId === legacyIdentity.bottleId &&
    alias.releaseId === legacyIdentity.releaseId;

  if (alias.releaseId !== null && !matchesLegacyIdentity) {
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

  if (
    alias.bottleId !== null &&
    alias.bottleId !== bottleId &&
    !matchesLegacyIdentity
  ) {
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

type CatalogTargetAliasClaimInput = {
  name: string;
  bottleId: number | null;
  targetId: number;
  legacyIdentity?: { bottleId: number; releaseId: number | null };
  expectedIdentity?: BottleAliasIdentitySnapshot;
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

/** Locks and claims one CatalogTarget alias for reservation or full assignment. */
async function claimCatalogTargetAliasNameInTransaction(
  tx: AnyTransaction,
  {
    name: aliasName,
    bottleId,
    targetId,
    legacyIdentity,
    expectedIdentity,
  }: CatalogTargetAliasClaimInput,
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

    if (expectedIdentity) {
      assertBottleAliasIdentitySnapshot(existingAlias, expectedIdentity);
    }

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
      legacyIdentity,
    });
    if (conflict) {
      throw new ExactBottleAliasConflictError(
        conflict.code,
        existingAlias,
        conflict.conflictingBottleId,
      );
    }

    if (existingAlias.targetId === targetId) {
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
        existingAlias.bottleId === bottleId &&
        existingAlias.releaseId === null &&
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
        .set({
          name: aliasName,
          bottleId,
          releaseId: null,
          ...assignmentUpdateValues,
        })
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
  const result = await claimCatalogTargetAliasNameInTransaction(tx, input, {
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
 * Retargets matching StorePrice and Review rows when `targetId` is non-null;
 * null targets update only targetless consumers. Returns an image candidate
 * and Review IDs used by post-lock compatibility correction.
 */
async function syncBottleAliasConsumersInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    releaseId,
    reviewReleaseId,
    targetId,
    externalSiteId,
    lookupNames,
    volume,
    imageBottleId,
  }: {
    bottleId: number | null;
    releaseId: number | null;
    reviewReleaseId: number | null;
    targetId: number | null;
    externalSiteId?: number;
    lookupNames: string[];
    volume?: number;
    imageBottleId: number | null;
  },
): Promise<BottleAliasConsumerBackfillResult> {
  const matchingPrices = await tx
    .update(storePrices)
    .set({ bottleId, releaseId, targetId })
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
        targetId === null ? isNull(storePrices.targetId) : undefined,
      ),
    )
    .returning({ imageUrl: storePrices.imageUrl });

  const reviewIds = await updateBottleAliasReviewsInTransaction(tx, {
    bottleId,
    releaseId: reviewReleaseId,
    targetId,
    externalSiteId,
    lookupNames,
  });

  const priceWithImage = matchingPrices.find((price) => !!price.imageUrl);
  return {
    bottleImageCandidate:
      priceWithImage?.imageUrl && imageBottleId !== null
        ? { bottleId: imageBottleId, imageUrl: priceWithImage.imageUrl }
        : null,
    reviewIds,
  };
}

async function updateBottleAliasReviewsInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    releaseId,
    targetId,
    externalSiteId,
    lookupNames,
  }: {
    bottleId: number | null;
    releaseId: number | null;
    targetId: number | null;
    externalSiteId?: number;
    lookupNames: string[];
  },
) {
  const matchingReviews = await tx
    .update(reviews)
    .set({ bottleId, releaseId, targetId })
    .where(
      and(
        or(
          ...lookupNames.map((value) => eq(sql`LOWER(${reviews.name})`, value)),
        ),
        externalSiteId !== undefined
          ? eq(reviews.externalSiteId, externalSiteId)
          : undefined,
        targetId === null ? isNull(reviews.targetId) : undefined,
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
 * A target-backed exact assignment uses its authoritative Bottle with a null
 * release. A generic assignment never substitutes a representative and may
 * carry either a separately validated retained pair or a null/null consumer
 * identity. A target resolved from a targetless legacy alias may keep that
 * measured pair for compatibility. Legacy `targetId` mode accepts exact targets
 * only. Omitted targets retain measured targetless compatibility without
 * downgrading a target-aware alias. `backfillNames` identify stored references
 * to repair. A same-name source snapshot is checked against the alias row
 * already locked by the claim; a distinct raw source is locked after the
 * normalized canonical claim.
 */
export async function assignBottleAliasInTransaction(
  tx: AnyTransaction,
  input: BottleAliasAssignmentInput,
): Promise<BottleAliasAssignmentResult> {
  const {
    externalSiteId,
    name,
    backfillNames = [],
    volume,
    ignored,
    assignmentSource,
    assignedByActorId,
    sourceAliasIdentity,
  } = input;
  const suppliedTarget = input.target;
  const targetId = input.targetId ?? null;
  const bottleId = suppliedTarget
    ? input.consumerIdentity.bottleId
    : input.bottleId;
  const releaseId = suppliedTarget
    ? input.consumerIdentity.releaseId
    : (input.releaseId ?? null);
  const aliasReleaseId = suppliedTarget
    ? null
    : targetId !== null
      ? null
      : input.aliasReleaseId === undefined
        ? releaseId
        : input.aliasReleaseId;
  if (!name.trim()) {
    throw new FailedToSaveBottleAliasError();
  }

  const isTargetAware = suppliedTarget !== undefined || targetId !== null;
  const compatibilityContext = !isTargetAware
    ? requireBottleAliasCompatibilityContext(input.context)
    : null;

  if (
    suppliedTarget !== undefined &&
    suppliedTarget.bottleId !== null &&
    input.consumerIdentity.bottleId === null
  ) {
    throw new TypeError(
      "Exact target alias assignment requires retained Bottle identity.",
    );
  }

  if (suppliedTarget) {
    await lockCatalogTargetAssignmentDescriptorInTransaction(
      tx,
      suppliedTarget,
    );
  }

  if (targetId !== null) {
    if (bottleId === null) {
      throw new TypeError(
        "Legacy exact target assignment requires retained Bottle identity.",
      );
    }
    await validateExactBottleAliasTarget(tx, { bottleId, targetId });
    if (aliasReleaseId !== null) {
      throw new InvalidExactBottleAliasTargetError(
        "legacy_release",
        targetId,
        bottleId,
      );
    }
  }

  const assignmentTargetId = suppliedTarget?.targetId ?? targetId;
  const aliasBottleId = suppliedTarget ? suppliedTarget.bottleId : bottleId;

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
  const sourceIsCanonicalName =
    sourceAliasIdentity?.name.toLowerCase() === name.toLowerCase();

  if (assignmentTargetId !== null) {
    // Target-aware mode holds merge-compatible identity locks, then consumers,
    // and only then the alias so ingestion never waits on an alias already held.
    nextAliasReleaseId = null;
    ({ bottleImageCandidate } = await syncBottleAliasConsumersInTransaction(
      tx,
      {
        bottleId,
        releaseId,
        reviewReleaseId: releaseId,
        targetId: assignmentTargetId,
        externalSiteId,
        lookupNames: consumerLookupNames,
        volume,
        imageBottleId: aliasBottleId,
      },
    ));
    const claim = await claimCatalogTargetAliasNameInTransaction(
      tx,
      {
        name,
        bottleId: aliasBottleId,
        targetId: assignmentTargetId,
        ...(suppliedTarget && bottleId !== null
          ? { legacyIdentity: { bottleId, releaseId } }
          : {}),
        ...(sourceAliasIdentity && sourceIsCanonicalName
          ? { expectedIdentity: sourceAliasIdentity }
          : {}),
      },
      {
        kind: "assignment",
        assignmentSource,
        assignedByActorId,
        ignored,
      },
    );
    alias = claim.alias;
    isNew = claim.inserted;
    if (sourceAliasIdentity && !sourceIsCanonicalName) {
      await lockBottleAliasIdentitySnapshotInTransaction(
        tx,
        sourceAliasIdentity,
      );
    }
  } else {
    if (bottleId === null) {
      throw new TypeError(
        "Targetless Bottle alias assignment requires retained Bottle identity.",
      );
    }
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
    const consumerBackfill = await syncBottleAliasConsumersInTransaction(tx, {
      bottleId,
      releaseId,
      reviewReleaseId: provisionalReviewReleaseId,
      targetId: null,
      externalSiteId,
      lookupNames: consumerLookupNames,
      volume,
      imageBottleId: bottleId,
    });
    bottleImageCandidate = consumerBackfill.bottleImageCandidate;

    for (let attempt = 0; attempt < 2 && !alias; attempt += 1) {
      const [existingAlias] = await tx
        .select()
        .from(bottleAliases)
        .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
        .limit(1)
        .for("update");
      if (sourceAliasIdentity && sourceIsCanonicalName) {
        assertBottleAliasIdentitySnapshot(existingAlias, sourceAliasIdentity);
      }
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
    if (sourceAliasIdentity && !sourceIsCanonicalName) {
      await lockBottleAliasIdentitySnapshotInTransaction(
        tx,
        sourceAliasIdentity,
      );
    }
    const actualReviewReleaseId = releaseId ?? nextAliasReleaseId;
    if (
      actualReviewReleaseId !== provisionalReviewReleaseId &&
      consumerBackfill.reviewIds.length
    ) {
      await tx
        .update(reviews)
        .set({ bottleId, releaseId: actualReviewReleaseId })
        .where(
          and(
            inArray(reviews.id, consumerBackfill.reviewIds),
            isNull(reviews.targetId),
          ),
        );
    }
  }

  if (!alias) {
    throw new FailedToSaveBottleAliasError();
  }

  if (compatibilityContext) {
    if (bottleId === null) {
      throw new TypeError(
        "Targetless Bottle alias assignment requires retained Bottle identity.",
      );
    }
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
 * Keeps raw alias producers working until their task 9.7 removal. Canonical
 * exact reservations and generic aliases with a retained legacy pair are safe
 * to replay; other target-aware assignments already synchronized a measured
 * consumer identity that cannot be reconstructed from the alias row.
 */
export async function syncBottleAliasConsumersForAliasChange(name: string) {
  const syncResult = await db.transaction(async (tx) => {
    const [alias] = await tx
      .select()
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
      .limit(1);
    if (!alias) {
      throw new Error(`Unknown bottle alias: ${name}`);
    }
    if (alias.bottleId === null) {
      return null;
    }

    let target: CatalogTargetAssignmentDescriptor | null = null;
    if (alias.targetId !== null) {
      target = await resolveCatalogTargetForAssignment(
        { kind: "target", targetId: alias.targetId },
        tx,
      );
      const isCanonicalExactReservation =
        target.bottleId === alias.bottleId &&
        alias.releaseId === null &&
        alias.assignmentSource === "canonical";
      const hasRetainedGenericIdentity = target.bottleId === null;
      if (!isCanonicalExactReservation && !hasRetainedGenericIdentity) {
        return null;
      }

      if (hasRetainedGenericIdentity) {
        const resolveRetainedGenericIdentity = () =>
          resolveCatalogTargetForAssignment(
            {
              kind: "legacy",
              bottleId: alias.bottleId!,
              releaseId: alias.releaseId,
              context: {
                caller: "OnBottleAliasChange",
                operation: "resolveRetainedGenericIdentity",
              },
            },
            tx,
          );
        const measuredTarget = await resolveRetainedGenericIdentity();
        if (
          measuredTarget.targetId !== target.targetId ||
          measuredTarget.groupId !== target.groupId ||
          measuredTarget.bottleId !== null
        ) {
          throw new CatalogTargetIntegrityMismatchError(
            { targetId: alias.targetId },
            "the retained alias pair does not resolve to its generic target",
          );
        }
        target = measuredTarget;
        await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);

        const lockedMeasuredTarget = await resolveRetainedGenericIdentity();
        if (
          lockedMeasuredTarget.targetId !== target.targetId ||
          lockedMeasuredTarget.groupId !== target.groupId ||
          lockedMeasuredTarget.bottleId !== null
        ) {
          throw new CatalogTargetIntegrityMismatchError(
            { targetId: alias.targetId },
            "the retained alias pair changed while locking its generic target",
          );
        }
        target = lockedMeasuredTarget;
      } else {
        await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
      }
    } else {
      // Targetless replay locks Bottle, then its optional Release, before
      // consumers; the conditional alias snapshot remains last.
      const [retainedBottle] = await tx
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.id, alias.bottleId))
        .limit(1)
        .for("update");
      if (!retainedBottle) {
        throw new Error(
          `Bottle alias retained Bottle is missing: ${alias.name}`,
        );
      }
      if (alias.releaseId !== null) {
        const [retainedRelease] = await tx
          .select({ bottleId: bottleReleases.bottleId })
          .from(bottleReleases)
          .where(eq(bottleReleases.id, alias.releaseId))
          .limit(1)
          .for("update");
        if (!retainedRelease || retainedRelease.bottleId !== alias.bottleId) {
          throw new CatalogTargetInvalidMappingError(
            alias.bottleId,
            alias.releaseId,
            "the release does not belong to the supplied parent Bottle",
          );
        }
      }
    }

    await syncBottleAliasConsumersInTransaction(tx, {
      bottleId: alias.bottleId,
      releaseId: alias.releaseId,
      reviewReleaseId: alias.releaseId,
      targetId: target?.targetId ?? null,
      lookupNames: [alias.name.toLowerCase()],
      imageBottleId: null,
    });

    const [unchangedAlias] = await tx
      .select({ name: bottleAliases.name })
      .from(bottleAliases)
      .where(
        and(
          eq(bottleAliases.name, alias.name),
          sql`${bottleAliases.bottleId} IS NOT DISTINCT FROM ${alias.bottleId}`,
          sql`${bottleAliases.releaseId} IS NOT DISTINCT FROM ${alias.releaseId}`,
          sql`${bottleAliases.targetId} IS NOT DISTINCT FROM ${alias.targetId}`,
          sql`${bottleAliases.ignored} IS NOT DISTINCT FROM ${alias.ignored}`,
          eq(bottleAliases.assignmentSource, alias.assignmentSource),
          eq(bottleAliases.assignedByActorId, alias.assignedByActorId),
          eq(bottleAliases.createdAt, alias.createdAt),
        ),
      )
      .limit(1)
      .for("update");
    if (!unchangedAlias) {
      throw new Error(
        `Bottle alias changed while syncing consumers: ${alias.name}`,
      );
    }
    return { alias, targetless: target === null };
  });

  if (syncResult?.targetless) {
    recordTargetlessBottleAliasCompatibility({
      bottleId: syncResult.alias.bottleId!,
      context: {
        caller: "OnBottleAliasChange",
        operation: "syncTargetlessConsumers",
      },
      releaseId: syncResult.alias.releaseId,
      name: syncResult.alias.name,
    });
  }
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
      await pushJob("IndexBottleAlias", { name: alias.name });
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
 * Assigns an exact or generic descriptor target, a legacy exact `targetId`, or
 * a measured targetless compatibility alias, then runs post-commit effects.
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
