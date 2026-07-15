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
  bottles,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, or, sql } from "drizzle-orm";

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

async function getExactBottleAliasConflict(
  tx: AnyTransaction,
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

/**
 * Owns durable exact-alias reservation, returns its reversal preimage, and
 * retries once when a concurrent unique-name insert wins.
 */
async function reserveExactBottleAliasNameInTransaction(
  tx: AnyTransaction,
  {
    name: aliasName,
    bottleId,
    targetId,
    assignmentSource,
    assignedByActorId,
  }: ExactBottleAliasReservationInput,
): Promise<ExactBottleAliasReservationWithPreimage> {
  if (!aliasName) {
    throw new FailedToSaveBottleAliasError();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [existingAlias] = await tx
      .select()
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
      .limit(1)
      .for("update");

    if (!existingAlias) {
      const [insertedAlias] = await tx
        .insert(bottleAliases)
        .values({
          name: aliasName,
          bottleId,
          releaseId: null,
          targetId,
          ignored: false,
          assignmentSource,
          assignedByActorId,
        })
        .onConflictDoNothing()
        .returning();
      if (insertedAlias) {
        return { name: insertedAlias.name, changed: true, before: null };
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
      return { name: existingAlias.name, changed: false };
    }

    const [claimedAlias] = await tx
      .update(bottleAliases)
      .set({
        name: aliasName,
        bottleId,
        releaseId: null,
        targetId,
        ignored: false,
        assignmentSource,
        assignedByActorId,
      })
      .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
      .returning();
    if (claimedAlias) {
      return {
        name: claimedAlias.name,
        changed: true,
        before: exactBottleAliasBeforeSnapshot(existingAlias),
      };
    }
  }

  throw new FailedToSaveBottleAliasError();
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
 * Assigns a confirmed exact alias inside an existing transaction and records
 * where that assignment came from. `name` is the accepted alias key;
 * `backfillNames` are legacy or raw stored references that should be repaired.
 */
export async function assignBottleAliasInTransaction(
  tx: AnyDatabase,
  {
    bottleId,
    releaseId = null,
    aliasReleaseId = releaseId,
    externalSiteId,
    name,
    backfillNames = [],
    volume,
    ignored,
    assignmentSource,
    assignedByActorId,
  }: {
    bottleId: number;
    releaseId?: number | null;
    aliasReleaseId?: number | null;
    externalSiteId?: number;
    name: string;
    backfillNames?: string[];
    volume?: number;
    // Initial ignored state when this call creates the assignment (new row or
    // claiming an unbound row). `true` keeps the row for provenance without
    // making it a reusable exact-match alias (e.g. a source-scoped store
    // listing title). Never mutates an alias already assigned to the target.
    ignored?: boolean;
  } & BottleAliasAssignmentOptions,
): Promise<{ alias: BottleAlias; isNew: boolean }> {
  if (!name.trim()) {
    throw new FailedToSaveBottleAliasError();
  }

  const assignmentOptions: BottleAliasAssignmentValues = {
    assignmentSource,
    assignedByActorId,
  };
  const existingAlias = await tx.query.bottleAliases.findFirst({
    where: eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
  });

  let alias: BottleAlias | undefined;
  let isNew = false;
  const nextAliasReleaseId =
    aliasReleaseId === null
      ? (existingAlias?.releaseId ?? null)
      : aliasReleaseId;

  const hasMatchingBottle = existingAlias?.bottleId === bottleId;
  const hasMatchingRelease =
    existingAlias?.releaseId === aliasReleaseId ||
    existingAlias?.releaseId === null ||
    aliasReleaseId === null;

  // `ignored` only applies when this call establishes a new assignment (fresh
  // insert or claiming an unbound row). An alias already assigned to the same
  // target keeps its stored ignored state: a classifier-scoped write must not
  // resurrect a moderator-ignored alias or deactivate an accepted active one.
  const ignoredSet = ignored !== undefined ? { ignored } : {};

  if (hasMatchingBottle && hasMatchingRelease) {
    const assignmentUpdateValues = getAssignmentUpdateValues(assignmentOptions);
    if (
      existingAlias.name !== name ||
      (existingAlias.releaseId ?? null) !== nextAliasReleaseId ||
      hasExplicitAssignmentOptions(assignmentOptions) ||
      existingAlias.assignedByActorId !== assignmentOptions.assignedByActorId
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
        ...ignoredSet,
        ...getAssignmentInsertValues(assignmentOptions),
      })
      .returning();
    isNew = true;
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

  if (!alias) {
    throw new FailedToSaveBottleAliasError();
  }

  const backfillLookupNames = Array.from(
    new Set(
      [name, ...backfillNames].map((value) => value.trim().toLowerCase()),
    ),
  ).filter(Boolean);
  const backfillNameFilter = or(
    ...backfillLookupNames.map((value) =>
      eq(sql`LOWER(${storePrices.name})`, value),
    ),
  );
  const matchingPrices = await tx
    .update(storePrices)
    .set({
      bottleId,
      releaseId,
    })
    .where(
      and(
        backfillNameFilter,
        externalSiteId !== undefined
          ? eq(storePrices.externalSiteId, externalSiteId)
          : undefined,
        volume !== undefined ? eq(storePrices.volume, volume) : undefined,
      ),
    )
    .returning({
      imageUrl: storePrices.imageUrl,
    });

  const priceWithImage = matchingPrices.find((price) => !!price.imageUrl);
  if (priceWithImage?.imageUrl) {
    const [bottle] = await tx
      .select({
        imageUrl: bottles.imageUrl,
      })
      .from(bottles)
      .where(eq(bottles.id, bottleId));

    if (bottle && !bottle.imageUrl) {
      await tx
        .update(bottles)
        .set({
          imageUrl: priceWithImage.imageUrl,
        })
        .where(eq(bottles.id, bottleId));
    }
  }

  await tx
    .update(reviews)
    .set({
      bottleId,
      releaseId: releaseId ?? nextAliasReleaseId,
    })
    .where(
      and(
        or(
          ...backfillLookupNames.map((value) =>
            eq(sql`LOWER(${reviews.name})`, value),
          ),
        ),
        externalSiteId !== undefined
          ? eq(reviews.externalSiteId, externalSiteId)
          : undefined,
      ),
    );

  return {
    alias,
    isNew,
  };
}

export async function finalizeBottleAliasAssignment(
  {
    alias,
    isNew,
  }: {
    alias: BottleAlias;
    isNew: boolean;
  },
  contexts?: Record<string, Record<string, any>>,
) {
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
 * Assigns an alias and runs the post-commit indexing/notification side effects.
 * Provenance options are forwarded to the transactional assignment.
 */
export async function assignBottleAlias(
  params: {
    bottleId: number;
    releaseId?: number | null;
    aliasReleaseId?: number | null;
    externalSiteId?: number;
    name: string;
    backfillNames?: string[];
    volume?: number;
  } & BottleAliasAssignmentOptions,
  contexts?: Record<string, Record<string, any>>,
) {
  const result = await db.transaction(async (tx) =>
    assignBottleAliasInTransaction(tx, params),
  );

  await finalizeBottleAliasAssignment(result, contexts);

  return result;
}
