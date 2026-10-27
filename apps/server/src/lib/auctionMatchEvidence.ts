import {
  BottleClassificationArtifactsSchema,
  ClassifyBottleReferenceInputSchema,
} from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import type { AuctionLot, BottleCheck } from "@peated/server/db/schema";
import { isSupportedBottleCheckSchemaVersion } from "./bottleCheckSchemaVersion";
import { PersistedReferenceBottleCheckOutputSchema } from "./bottleChecks";
import { assessBottleResolution } from "./bottleMatchingAutomation";

export function auctionLotCheckKey(lotId: number, fingerprint: string) {
  return `auction-lot:${lotId}:${fingerprint}`;
}

/**
 * Auction matching owns freshness: a saved decision belongs to one identity
 * version. Lots with the same fingerprint share one check (see
 * `findSharedAuctionLotCheck`), so the check may come from an identical lot.
 */
export function isAuctionLotIdentityCheck(
  lot: Pick<AuctionLot, "sourceFingerprint">,
  check: Pick<BottleCheck, "sourceKind" | "sourceId" | "backgroundEventKey">,
) {
  return (
    check.sourceKind === "auction_lot" &&
    check.backgroundEventKey ===
      auctionLotCheckKey(Number(check.sourceId), lot.sourceFingerprint)
  );
}

export function readAuctionMatchEvidence(
  lot: Pick<AuctionLot, "id" | "sourceFingerprint" | "name">,
  check: BottleCheck | null | undefined,
) {
  if (
    !check ||
    !isSupportedBottleCheckSchemaVersion(check) ||
    check.intent !== "resolve_reference" ||
    !isAuctionLotIdentityCheck(lot, check)
  )
    return null;
  const input = ClassifyBottleReferenceInputSchema.safeParse(
    check.inputSnapshot,
  );
  const output = PersistedReferenceBottleCheckOutputSchema.safeParse(
    check.output,
  );
  const artifacts = BottleClassificationArtifactsSchema.safeParse(
    check.artifacts,
  );
  if (
    !input.success ||
    !output.success ||
    !artifacts.success ||
    input.data.reference.id !== Number(check.sourceId) ||
    normalizeBottleReferenceKey(input.data.reference.name) !==
      normalizeBottleReferenceKey(lot.name)
  )
    return null;
  return { output: output.data, artifacts: artifacts.data };
}

export function assessAuctionMatch(lot: AuctionLot, check: BottleCheck) {
  const evidence = readAuctionMatchEvidence(lot, check);
  if (
    !evidence ||
    evidence.output.status !== "classified" ||
    evidence.output.decision.action === "no_match"
  )
    return null;
  const { decision } = evidence.output;
  const assessment = assessBottleResolution({
    decision,
    currentBottleId: lot.bottleId,
    candidates: evidence.artifacts.candidates,
    referenceName: lot.name,
    sourceBottleIdentity: lot.sourceBottleIdentity,
    readListingImage: evidence.artifacts.extractedIdentitySource === "image",
  });
  const target = evidence.artifacts.candidates.find(
    ({ bottleId }) => bottleId === decision.matchedBottleId,
  );
  // Exact-reference preflight is an accepted-reference decision, not independent model evidence.
  const referenceName = target?.source.includes("exact")
    ? target.reference
    : null;
  if (target?.source.includes("exact") && !referenceName) return null;
  return {
    ...assessment,
    bottleId: decision.matchedBottleId,
    referenceName,
  };
}
