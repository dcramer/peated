import { db, type AnyDatabase } from "@peated/server/db";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetBatch,
  loadCatalogTargetByLegacyReference,
  type CatalogTargetOperationContext,
  type LegacyCatalogTargetReference,
} from "@peated/server/lib/catalogTargets";
import { logTelemetryError } from "@peated/server/lib/log";
import type { CatalogTargetV1 } from "@peated/server/schemas/catalogIdentity";
import type { CatalogIdentitySerializerContext } from "@peated/server/serializers/catalogIdentity";

type CatalogTargetReadParityIdentity = {
  targetId: number | null;
  legacy: CatalogTargetReadLegacyReference;
};

type CatalogTargetReadLegacyReference = {
  bottleId: number | null;
  releaseId: number | null;
};

type CorrelatedConsumerLocator =
  | {
      consumerTable: "bottle_alias";
      rowLocator: { name: string };
    }
  | {
      consumerTable: "collection_bottle";
      rowLocator: { id: number };
    }
  | {
      consumerTable: "flight_bottle";
      rowLocator: {
        bottleId: number;
        flightId: number;
        releaseId: number | null;
      };
    }
  | {
      consumerTable: "incoming_bottle_decision_log";
      rowLocator: { id: number };
    }
  | {
      consumerTable: "review";
      rowLocator: { id: number };
    }
  | {
      consumerTable: "store_price";
      rowLocator: { id: number };
    }
  | {
      consumerTable: "store_price_match_proposal";
      rowLocator: {
        id: number;
        slot: "current" | "suggested";
      };
    }
  | {
      consumerTable: "tasting";
      rowLocator: { id: number };
    };

export type CatalogTargetReadParityItem = CatalogTargetReadParityIdentity &
  CorrelatedConsumerLocator;

type CatalogTargetReadParityMismatchDetails = {
  legacyBottleId: number | null;
  legacyReleaseId: number | null;
  targetId: number | null;
  caller: string;
  operation: string;
  targetResolution: CatalogIdentityResolution;
  legacyResolution: CatalogIdentityResolution;
};

export type CatalogTargetReadParityMismatch = CorrelatedConsumerLocator &
  CatalogTargetReadParityMismatchDetails;

export type CatalogTargetReadParityContext = CatalogIdentitySerializerContext &
  CatalogTargetOperationContext;

type ResolvedCatalogIdentity = {
  status: "resolved";
  kind: CatalogTargetV1["kind"];
  targetId: number;
  groupId: number;
  bottleId: number | null;
};

type CatalogIdentityResolution =
  | ResolvedCatalogIdentity
  | { status: "missing" }
  | { status: "error"; code: string };

type CatalogTargetReadLegacyResult = {
  target: CatalogTargetV1 | null;
  resolution: CatalogIdentityResolution;
};

export type CatalogTargetReadParityResult = {
  targets: (CatalogTargetV1 | null)[];
  legacyTargets: (CatalogTargetV1 | null)[];
  mismatches: CatalogTargetReadParityMismatch[];
};

export type CatalogTargetReadFilterParityCandidate =
  CatalogTargetReadParityItem & {
    filter:
      | "assigned"
      | "catalog_reference"
      | "entity"
      | "only_unknown"
      | "query";
    targetMatches: boolean;
    legacyMatches: boolean;
  };

export type CatalogTargetReadFilterParityMismatch =
  CorrelatedConsumerLocator & {
    legacyBottleId: number | null;
    legacyReleaseId: number | null;
    targetId: number | null;
    caller: string;
    operation: string;
    filter: CatalogTargetReadFilterParityCandidate["filter"];
    targetMatches: boolean;
    legacyMatches: boolean;
  };

function resolvedIdentity(target: CatalogTargetV1): ResolvedCatalogIdentity {
  return {
    status: "resolved",
    kind: target.kind,
    targetId: target.targetId,
    groupId: target.group.id,
    bottleId: target.kind === "bottle" ? target.bottle.id : null,
  };
}

function resolutionError(error: unknown): CatalogIdentityResolution {
  return {
    status: "error",
    code:
      error instanceof CatalogTargetResolutionError
        ? error.code
        : "UNEXPECTED_CATALOG_TARGET_ERROR",
  };
}

/** Resolves retained references once per distinct pair for bounded parity reads. */
export async function loadLegacyCatalogTargetReadBatch(
  references: CatalogTargetReadLegacyReference[],
  context: CatalogTargetReadParityContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetReadLegacyResult[]> {
  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Catalog target read parity requires caller and operation context.",
    );
  }

  const byReference = new Map<string, Promise<CatalogTargetReadLegacyResult>>();
  const resolve = (
    reference: CatalogTargetReadLegacyReference,
  ): Promise<CatalogTargetReadLegacyResult> => {
    if (reference.bottleId === null) {
      return Promise.resolve({
        target: null,
        resolution:
          reference.releaseId === null
            ? { status: "missing" }
            : { status: "error", code: "LEGACY_RELEASE_WITHOUT_BOTTLE" },
      });
    }

    const key = `${reference.bottleId}:${reference.releaseId ?? "null"}`;
    let pending = byReference.get(key);
    if (!pending) {
      const legacyReference: LegacyCatalogTargetReference = {
        bottleId: reference.bottleId,
        releaseId: reference.releaseId,
      };
      pending = loadCatalogTargetByLegacyReference(
        legacyReference,
        context,
        database,
      ).then(
        (target) => ({ target, resolution: resolvedIdentity(target) }),
        (error: unknown) => ({
          target: null,
          resolution: resolutionError(error),
        }),
      );
      byReference.set(key, pending);
    }
    return pending;
  };

  return await Promise.all(references.map(resolve));
}

function identitiesMatch(
  target: ResolvedCatalogIdentity,
  legacy: ResolvedCatalogIdentity,
): boolean {
  return (
    target.kind === legacy.kind &&
    target.targetId === legacy.targetId &&
    target.groupId === legacy.groupId &&
    target.bottleId === legacy.bottleId
  );
}

function recordMismatch(mismatch: CatalogTargetReadParityMismatch): void {
  logTelemetryError("Catalog target read parity mismatch", {
    extra: {
      event: "catalog_target.read_parity_mismatch",
      ...mismatch,
    },
  });
}

function consumerLocator(
  item: CatalogTargetReadParityItem,
): CorrelatedConsumerLocator {
  switch (item.consumerTable) {
    case "bottle_alias":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "collection_bottle":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "flight_bottle":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "incoming_bottle_decision_log":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "review":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "store_price":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "store_price_match_proposal":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
    case "tasting":
      return {
        consumerTable: item.consumerTable,
        rowLocator: item.rowLocator,
      };
  }
}

/** Records bounded route-filter membership drift without changing list results. */
export function recordCatalogTargetReadFilterParity(
  candidates: CatalogTargetReadFilterParityCandidate[],
  context: CatalogTargetOperationContext,
): CatalogTargetReadFilterParityMismatch[] {
  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Catalog target read filter parity requires caller and operation context.",
    );
  }

  return candidates.flatMap((candidate) => {
    if (candidate.targetMatches === candidate.legacyMatches) return [];
    const mismatch: CatalogTargetReadFilterParityMismatch = {
      ...consumerLocator(candidate),
      legacyBottleId: candidate.legacy.bottleId,
      legacyReleaseId: candidate.legacy.releaseId,
      targetId: candidate.targetId,
      caller: context.caller,
      operation: context.operation,
      filter: candidate.filter,
      targetMatches: candidate.targetMatches,
      legacyMatches: candidate.legacyMatches,
    };
    logTelemetryError("Catalog target read filter parity mismatch", {
      extra: {
        event: "catalog_target.read_filter_parity_mismatch",
        ...mismatch,
      },
    });
    return [mismatch];
  });
}

function mismatchFor(
  item: CatalogTargetReadParityItem,
  context: CatalogTargetReadParityContext,
  targetResolution: CatalogIdentityResolution,
  legacyResolution: CatalogIdentityResolution,
): CatalogTargetReadParityMismatch {
  return {
    ...consumerLocator(item),
    legacyBottleId: item.legacy.bottleId,
    legacyReleaseId: item.legacy.releaseId,
    targetId: item.targetId,
    caller: context.caller,
    operation: context.operation,
    targetResolution,
    legacyResolution,
  };
}

/**
 * Loads durable targets in one batch and measures retained-pair parity without
 * allowing a non-null target failure to fall back to legacy identity.
 */
export async function loadCatalogTargetReadsWithParity(
  items: CatalogTargetReadParityItem[],
  context: CatalogTargetReadParityContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetReadParityResult> {
  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Catalog target read parity requires caller and operation context.",
    );
  }

  const targetIds = items.flatMap(({ targetId }) =>
    targetId === null ? [] : [targetId],
  );
  const targetResolutions = await loadCatalogTargetBatch(
    targetIds,
    context,
    database,
  );
  const legacyResults = await loadLegacyCatalogTargetReadBatch(
    items.map(({ legacy }) => legacy),
    context,
    database,
  );

  const targets: (CatalogTargetV1 | null)[] = [];
  const legacyTargets: (CatalogTargetV1 | null)[] = [];
  const mismatches: CatalogTargetReadParityMismatch[] = [];
  let authoritativeError: unknown;
  for (const [index, item] of items.entries()) {
    let target: CatalogTargetV1 | null = null;
    let targetResolution: CatalogIdentityResolution = { status: "missing" };
    let durableError: unknown;
    if (item.targetId !== null) {
      const durableResolution = targetResolutions.get(item.targetId);
      if (!durableResolution) {
        throw new Error(`Missing CatalogTarget batch result: ${item.targetId}`);
      }
      if (durableResolution.ok) {
        target = durableResolution.target;
        targetResolution = resolvedIdentity(durableResolution.target);
      } else {
        durableError = durableResolution.error;
        targetResolution = resolutionError(durableResolution.error);
      }
    }
    targets.push(target);

    const legacyResult = legacyResults[index];
    if (!legacyResult) {
      throw new Error(`Missing legacy CatalogTarget batch result: ${index}`);
    }
    const legacyResolution = legacyResult.resolution;
    legacyTargets.push(legacyResult.target);

    if (durableError) authoritativeError ??= durableError;

    const matches =
      (targetResolution.status === "missing" &&
        legacyResolution.status === "missing") ||
      (targetResolution.status === "resolved" &&
        legacyResolution.status === "resolved" &&
        identitiesMatch(targetResolution, legacyResolution));
    if (!matches) {
      const mismatch = mismatchFor(
        item,
        context,
        targetResolution,
        legacyResolution,
      );
      mismatches.push(mismatch);
      recordMismatch(mismatch);
    }
  }

  if (authoritativeError) throw authoritativeError;
  return { targets, legacyTargets, mismatches };
}
