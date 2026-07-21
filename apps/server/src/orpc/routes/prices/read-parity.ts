import {
  loadCatalogTargetReadsWithParity,
  recordCatalogTargetReadFilterParity,
} from "@peated/server/lib/catalogTargetReadParity";

export type StorePriceReadParityCandidate = {
  id: number;
  targetId: number | null;
  bottleId: number | null;
  releaseId: number | null;
  targetMatches: boolean;
  legacyMatches: boolean;
};

/**
 * Records identity and route-membership parity for the supplied StorePrice
 * candidates. The caller owns candidate coverage and any sampling bounds.
 */
export async function recordStorePriceReadParity(
  candidates: StorePriceReadParityCandidate[],
  context: { caller: string; operation: string },
  filter: "assigned" | "catalog_reference" | "only_unknown",
): Promise<{
  identityMismatches: Awaited<
    ReturnType<typeof loadCatalogTargetReadsWithParity>
  >["mismatches"];
  filterMismatches: ReturnType<typeof recordCatalogTargetReadFilterParity>;
}> {
  const items = candidates.map((candidate) => ({
    consumerTable: "store_price" as const,
    rowLocator: { id: candidate.id },
    targetId: candidate.targetId,
    legacy: {
      bottleId: candidate.bottleId,
      releaseId: candidate.releaseId,
    },
  }));

  const { mismatches: identityMismatches } =
    await loadCatalogTargetReadsWithParity(items, {
      actor: null,
      permissions: { canReadCatalogIdentity: true },
      ...context,
    });
  const filterMismatches = recordCatalogTargetReadFilterParity(
    candidates.map((candidate, index) => ({
      ...items[index],
      filter,
      targetMatches: candidate.targetMatches,
      legacyMatches: candidate.legacyMatches,
    })),
    context,
  );
  return { identityMismatches, filterMismatches };
}
