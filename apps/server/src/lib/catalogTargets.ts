/**
 * Owns CatalogTarget resolution and assignment. Generic intent remains generic,
 * while measured legacy pairs resolve only through staged migration mappings.
 */
import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { readExactBottleMergePromotionHistory } from "@peated/server/lib/exactBottleMergePromotionMetadata";
import { logInfo } from "@peated/server/lib/log";
import type { CatalogTargetV1 } from "@peated/server/schemas/catalogIdentity";
import { serialize } from "@peated/server/serializers";
import {
  CatalogTargetSerializer,
  type CatalogIdentitySerializerContext,
  type CatalogTargetSerializerItem,
} from "@peated/server/serializers/catalogIdentity";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { ZodError } from "zod";

export type CatalogTargetIdentity =
  | { targetId: number }
  | { bottleId: number }
  | { groupId: number };

export type CatalogTargetResolutionErrorCode =
  | "CATALOG_TARGET_NOT_FOUND"
  | "CATALOG_TARGET_RETIRED"
  | "CATALOG_TARGET_INVALID_MAPPING"
  | "CATALOG_TARGET_INTEGRITY_MISMATCH";

export abstract class CatalogTargetResolutionError extends Error {
  protected constructor(
    readonly code: CatalogTargetResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CatalogTargetNotFoundError extends CatalogTargetResolutionError {
  constructor(readonly identity: CatalogTargetIdentity) {
    super(
      "CATALOG_TARGET_NOT_FOUND",
      `Catalog target not found (${formatIdentity(identity)}).`,
    );
  }
}

export type RetiredCatalogTargetReplacement =
  | { kind: "group"; groupId: number }
  | { kind: "bottle"; bottleId: number };

export class CatalogTargetRetiredError extends CatalogTargetResolutionError {
  constructor(
    readonly identity: CatalogTargetIdentity,
    readonly replacement: RetiredCatalogTargetReplacement | null,
  ) {
    super(
      "CATALOG_TARGET_RETIRED",
      `Catalog target is retired (${formatIdentity(identity)}).`,
    );
  }
}

export class CatalogTargetInvalidMappingError extends CatalogTargetResolutionError {
  constructor(
    readonly bottleId: number,
    readonly releaseId: number | null,
    readonly reason: string,
  ) {
    super(
      "CATALOG_TARGET_INVALID_MAPPING",
      `Legacy catalog target mapping is invalid (${bottleId}, ${releaseId ?? "null"}): ${reason}.`,
    );
  }
}

export class CatalogTargetIntegrityMismatchError extends CatalogTargetResolutionError {
  constructor(
    readonly identity: CatalogTargetIdentity,
    readonly reason: string,
  ) {
    super(
      "CATALOG_TARGET_INTEGRITY_MISMATCH",
      `Catalog target integrity mismatch (${formatIdentity(identity)}): ${reason}.`,
    );
  }
}

export type LegacyCatalogTargetReference = {
  bottleId: number;
  releaseId: number | null;
};

export type CatalogTargetOperationContext = {
  caller: string;
  operation: string;
};

export type LegacyCatalogTargetResolutionContext =
  CatalogIdentitySerializerContext & CatalogTargetOperationContext;

export type CatalogTargetAssignmentIntent =
  | { kind: "target"; targetId: number }
  | { kind: "bottle"; bottleId: number }
  | { kind: "group"; groupId: number }
  | ({
      kind: "legacy";
      context: CatalogTargetOperationContext;
    } & LegacyCatalogTargetReference);

type LegacyCatalogTargetAccess = "read" | "write";

function formatIdentity(identity: CatalogTargetIdentity): string {
  if ("targetId" in identity) return `targetId=${identity.targetId}`;
  if ("bottleId" in identity) return `bottleId=${identity.bottleId}`;
  return `groupId=${identity.groupId}`;
}

function assertOperationContext(context: CatalogTargetOperationContext): void {
  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Catalog target compatibility context requires caller and operation.",
    );
  }
}

function recordLegacyCatalogTargetUsage(
  reference: LegacyCatalogTargetReference,
  context: CatalogTargetOperationContext,
  access: LegacyCatalogTargetAccess,
): void {
  assertOperationContext(context);
  logInfo("Legacy catalog target compatibility {access}", {
    extra: {
      event: "catalog_target.compatibility",
      access,
      caller: context.caller,
      operation: context.operation,
      bottleId: reference.bottleId,
      releaseId: reference.releaseId,
    },
  });
}

async function queryCatalogTarget(database: AnyDatabase, where: SQL<unknown>) {
  return await database.query.catalogTargets.findFirst({
    where,
    with: {
      group: {
        with: {
          distillers: true,
        },
      },
      bottle: true,
    },
  });
}

type HydratedCatalogTarget = NonNullable<
  Awaited<ReturnType<typeof queryCatalogTarget>>
>;

async function throwIfGroupRetired(
  groupId: number,
  database: AnyDatabase,
): Promise<void> {
  const tombstone = await database.query.bottleGroupTombstones.findFirst({
    where: eq(bottleGroupTombstones.groupId, groupId),
  });
  if (tombstone) {
    throw new CatalogTargetRetiredError(
      { groupId },
      { kind: "group", groupId: tombstone.newGroupId },
    );
  }
}

async function throwIfBottleRetired(
  bottleId: number,
  database: AnyDatabase,
): Promise<void> {
  const tombstone = await database.query.bottleTombstones.findFirst({
    where: eq(bottleTombstones.bottleId, bottleId),
  });
  if (tombstone) {
    throw new CatalogTargetRetiredError(
      { bottleId },
      tombstone.newBottleId === null
        ? null
        : { kind: "bottle", bottleId: tombstone.newBottleId },
    );
  }
}

function assertTargetIntegrity(target: HydratedCatalogTarget): void {
  if (!target.group || target.group.id !== target.groupId) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.id },
      "the hydrated group does not match the stored group id",
    );
  }

  if (target.bottleId === null) {
    if (target.bottle) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId: target.id },
        "a generic target hydrated an exact Bottle",
      );
    }
    return;
  }

  if (
    !target.bottle ||
    target.bottle.id !== target.bottleId ||
    target.bottle.groupId !== target.groupId
  ) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.id },
      "the exact Bottle does not match the stored target membership",
    );
  }
}

async function assertTargetActive(
  target: HydratedCatalogTarget,
  database: AnyDatabase,
): Promise<void> {
  await throwIfGroupRetired(target.groupId, database);
  if (target.bottleId !== null) {
    await throwIfBottleRetired(target.bottleId, database);
  }
}

async function findTargetById(
  targetId: number,
  database: AnyDatabase,
): Promise<HydratedCatalogTarget> {
  const target = await queryCatalogTarget(
    database,
    eq(catalogTargets.id, targetId),
  );
  if (!target) throw new CatalogTargetNotFoundError({ targetId });
  assertTargetIntegrity(target);
  await assertTargetActive(target, database);
  return target;
}

async function findTargetByBottleId(
  bottleId: number,
  database: AnyDatabase,
): Promise<HydratedCatalogTarget> {
  await throwIfBottleRetired(bottleId, database);
  const target = await queryCatalogTarget(
    database,
    eq(catalogTargets.bottleId, bottleId),
  );
  if (!target) throw new CatalogTargetNotFoundError({ bottleId });
  assertTargetIntegrity(target);
  await throwIfGroupRetired(target.groupId, database);
  return target;
}

async function findTargetByGroupId(
  groupId: number,
  database: AnyDatabase,
): Promise<HydratedCatalogTarget> {
  await throwIfGroupRetired(groupId, database);
  const target = await queryCatalogTarget(
    database,
    and(eq(catalogTargets.groupId, groupId), isNull(catalogTargets.bottleId))!,
  );
  if (!target) throw new CatalogTargetNotFoundError({ groupId });
  assertTargetIntegrity(target);
  return target;
}

function toSerializerItem(
  target: HydratedCatalogTarget,
): CatalogTargetSerializerItem {
  return {
    ...target,
    group: {
      ...target.group,
      distillerIds: target.group.distillers.map(
        ({ distillerId }) => distillerId,
      ),
    },
    bottle: target.bottle ?? null,
  };
}

async function serializeTarget(
  target: HydratedCatalogTarget,
  context: CatalogIdentitySerializerContext,
): Promise<CatalogTargetV1> {
  try {
    return await serialize(
      CatalogTargetSerializer,
      toSerializerItem(target),
      undefined,
      [],
      context,
    );
  } catch (error) {
    if (error instanceof ZodError) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId: target.id },
        error.message,
      );
    }
    throw error;
  }
}

/** Validates the durable, contiguous merge chain behind a moved promotion. */
async function promotionConvergedByExactMerges({
  metadata,
  sourceGroupId,
  destinationBottleId,
  destinationGroupId,
  database,
}: {
  metadata: unknown;
  sourceGroupId: number;
  destinationBottleId: number;
  destinationGroupId: number;
  database: AnyDatabase;
}): Promise<boolean> {
  const history = readExactBottleMergePromotionHistory(metadata);
  if (!history.length) return false;

  let expectedSourceBottleId: number | null = null;
  let expectedSourceGroupId = sourceGroupId;
  for (const event of history) {
    if (
      event.sourceGroupId !== expectedSourceGroupId ||
      (expectedSourceBottleId !== null &&
        event.sourceBottleId !== expectedSourceBottleId)
    ) {
      return false;
    }
    expectedSourceBottleId = event.destinationBottleId;
    expectedSourceGroupId = event.destinationGroupId;
  }
  if (
    expectedSourceBottleId !== destinationBottleId ||
    expectedSourceGroupId !== destinationGroupId
  ) {
    return false;
  }

  const sourceBottleIds = history.map(({ sourceBottleId }) => sourceBottleId);
  if (
    new Set(sourceBottleIds).size !== sourceBottleIds.length ||
    sourceBottleIds.includes(destinationBottleId)
  ) {
    return false;
  }
  const [tombstones, liveSources] = await Promise.all([
    database.query.bottleTombstones.findMany({
      where: inArray(bottleTombstones.bottleId, sourceBottleIds),
    }),
    database.query.bottles.findMany({
      where: inArray(bottles.id, sourceBottleIds),
      columns: { id: true },
    }),
  ]);
  return (
    liveSources.length === 0 &&
    tombstones.length === sourceBottleIds.length &&
    tombstones.every(({ newBottleId }) => newBottleId === destinationBottleId)
  );
}

/**
 * Promoted releases resolve exactly; parent-only references use release
 * cardinality to choose the group target or retained Bottle target.
 */
async function findLegacyTarget(
  reference: LegacyCatalogTargetReference,
  context: CatalogTargetOperationContext,
  access: LegacyCatalogTargetAccess,
  database: AnyDatabase,
): Promise<HydratedCatalogTarget> {
  recordLegacyCatalogTargetUsage(reference, context, access);

  if (reference.releaseId !== null) {
    const release = await database.query.bottleReleases.findFirst({
      where: (bottleReleases, { eq }) =>
        eq(bottleReleases.id, reference.releaseId as number),
      with: { bottle: true },
    });
    if (!release || release.bottleId !== reference.bottleId) {
      throw new CatalogTargetInvalidMappingError(
        reference.bottleId,
        reference.releaseId,
        "the release does not belong to the supplied parent Bottle",
      );
    }

    const promotion = await database.query.bottleReleasePromotions.findFirst({
      where: eq(bottleReleasePromotions.releaseId, reference.releaseId),
    });
    if (
      !promotion ||
      promotion.status !== "promoted" ||
      promotion.promotedBottleId === null
    ) {
      throw new CatalogTargetInvalidMappingError(
        reference.bottleId,
        reference.releaseId,
        "the release does not have a completed promotion mapping",
      );
    }

    let target: HydratedCatalogTarget;
    try {
      target = await findTargetByBottleId(promotion.promotedBottleId, database);
    } catch (error) {
      if (!(error instanceof CatalogTargetNotFoundError)) throw error;
      throw new CatalogTargetIntegrityMismatchError(
        { bottleId: promotion.promotedBottleId },
        "the promoted Bottle has no exact target",
      );
    }

    if (
      release.bottle?.groupId !== null &&
      release.bottle?.groupId !== undefined &&
      release.bottle.groupId !== target.groupId
    ) {
      const convergedByExactMerge = await promotionConvergedByExactMerges({
        metadata: promotion.auditMetadata,
        sourceGroupId: release.bottle.groupId,
        destinationBottleId: promotion.promotedBottleId,
        destinationGroupId: target.groupId,
        database,
      });
      if (!convergedByExactMerge) {
        throw new CatalogTargetIntegrityMismatchError(
          { targetId: target.id },
          "the promoted Bottle belongs to a different group than the legacy parent",
        );
      }
    }

    return target;
  }

  const parent = await database.query.bottles.findFirst({
    where: eq(bottles.id, reference.bottleId),
    with: {
      releases: {
        columns: { id: true },
      },
    },
  });
  if (!parent) {
    await throwIfBottleRetired(reference.bottleId, database);
    throw new CatalogTargetNotFoundError({ bottleId: reference.bottleId });
  }
  if (parent.groupId === null) {
    throw new CatalogTargetInvalidMappingError(
      reference.bottleId,
      null,
      "the legacy parent has not been assigned to a BottleGroup",
    );
  }

  try {
    return parent.releases.length > 0
      ? await findTargetByGroupId(parent.groupId, database)
      : await findTargetByBottleId(parent.id, database);
  } catch (error) {
    if (!(error instanceof CatalogTargetNotFoundError)) throw error;
    throw new CatalogTargetInvalidMappingError(
      reference.bottleId,
      null,
      parent.releases.length > 0
        ? "the legacy parent group has no generic target"
        : "the retained Bottle has no exact target",
    );
  }
}

/** Load one target by its durable target id without changing generic intent. */
export async function loadCatalogTarget(
  targetId: number,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetV1> {
  return await serializeTarget(
    await findTargetById(targetId, database),
    context,
  );
}

/** Load the exact target owned by one concrete Bottle. */
export async function loadCatalogTargetByBottleId(
  bottleId: number,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetV1> {
  return await serializeTarget(
    await findTargetByBottleId(bottleId, database),
    context,
  );
}

/** Load the generic target for a BottleGroup without selecting a representative. */
export async function loadCatalogTargetByGroupId(
  groupId: number,
  context: CatalogIdentitySerializerContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetV1> {
  return await serializeTarget(
    await findTargetByGroupId(groupId, database),
    context,
  );
}

/** Resolve a measured legacy pair using promotion and parent-cardinality rules. */
export async function loadCatalogTargetByLegacyReference(
  reference: LegacyCatalogTargetReference,
  context: LegacyCatalogTargetResolutionContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetV1> {
  return await serializeTarget(
    await findLegacyTarget(reference, context, "read", database),
    context,
  );
}

/** Resolve the one target id a dual-write consumer must persist. */
export async function resolveCatalogTargetIdForAssignment(
  intent: CatalogTargetAssignmentIntent,
  database: AnyDatabase = db,
): Promise<number> {
  switch (intent.kind) {
    case "target":
      return (await findTargetById(intent.targetId, database)).id;
    case "bottle":
      return (await findTargetByBottleId(intent.bottleId, database)).id;
    case "group":
      return (await findTargetByGroupId(intent.groupId, database)).id;
    case "legacy":
      return (await findLegacyTarget(intent, intent.context, "write", database))
        .id;
  }
}
