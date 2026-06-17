import { db, type AnyDatabase } from "@peated/server/db";
import type {
  BottleAlias,
  BottleAliasAssignmentSource,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
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

type BottleAliasAssignmentOptions = {
  assignmentSource?: BottleAliasAssignmentSource;
  assignedById?: number | null;
};

type BottleAliasAssignmentValues = {
  assignmentSource?: BottleAliasAssignmentSource;
  assignedById?: number | null;
};

function hasExplicitAssignmentOptions(options: BottleAliasAssignmentValues) {
  return (
    options.assignmentSource !== undefined || options.assignedById !== undefined
  );
}

function getAssignmentInsertValues({
  assignmentSource = "legacy",
  assignedById = null,
}: BottleAliasAssignmentValues) {
  return {
    assignmentSource,
    assignedById,
  };
}

function getAssignmentUpdateValues(options: BottleAliasAssignmentValues) {
  return {
    ...(options.assignmentSource !== undefined
      ? { assignmentSource: options.assignmentSource }
      : {}),
    ...(options.assignedById !== undefined
      ? { assignedById: options.assignedById }
      : {}),
  };
}

/**
 * Assigns a confirmed exact alias inside an existing transaction and records
 * where that assignment came from.
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
    assignmentSource,
    assignedById,
  }: {
    bottleId: number;
    releaseId?: number | null;
    aliasReleaseId?: number | null;
    externalSiteId?: number;
    name: string;
    backfillNames?: string[];
    volume?: number;
  } & BottleAliasAssignmentOptions,
): Promise<{ alias: BottleAlias; isNew: boolean }> {
  if (!name.trim()) {
    throw new FailedToSaveBottleAliasError();
  }

  const assignmentOptions: BottleAliasAssignmentValues = {
    assignmentSource,
    assignedById,
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

  if (hasMatchingBottle && hasMatchingRelease) {
    const assignmentUpdateValues = getAssignmentUpdateValues(assignmentOptions);
    if (
      existingAlias.name !== name ||
      (existingAlias.releaseId ?? null) !== nextAliasReleaseId ||
      hasExplicitAssignmentOptions(assignmentOptions)
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
      releaseId: nextAliasReleaseId,
    })
    .where(
      or(
        ...backfillLookupNames.map((value) =>
          eq(sql`LOWER(${reviews.name})`, value),
        ),
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
