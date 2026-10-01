import {
  BottleClassificationArtifactsSchema,
  ClassifyBottleReferenceInputSchema,
} from "@peated/bottle-classifier/contract";
import type { AuctionLot, BottleCheck } from "@peated/server/db/schema";
import { isSupportedBottleCheckSchemaVersion } from "./bottleCheckSchemaVersion";
import { PersistedReferenceBottleCheckOutputSchema } from "./bottleChecks";
import { assessExistingBottleMatch } from "./bottleMatchingAutomation";

export function auctionLotCheckKey(lotId: number, fingerprint: string) {
  return `auction-lot:${lotId}:${fingerprint}`;
}

/** Auction matching owns freshness: a saved decision belongs to one occurrence and identity version. */
export function readAuctionMatchEvidence(
  lot: Pick<AuctionLot, "id" | "sourceFingerprint" | "name">,
  check: BottleCheck | null | undefined,
) {
  if (
    !check ||
    !isSupportedBottleCheckSchemaVersion(check) ||
    check.intent !== "resolve_reference" ||
    check.sourceKind !== "auction_lot" ||
    check.sourceId !== String(lot.id) ||
    check.backgroundEventKey !==
      auctionLotCheckKey(lot.id, lot.sourceFingerprint)
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
    input.data.reference.id !== lot.id ||
    input.data.reference.name !== lot.name
  )
    return null;
  return { output: output.data, artifacts: artifacts.data };
}

export function assessAuctionMatch(lot: AuctionLot, check: BottleCheck) {
  const evidence = readAuctionMatchEvidence(lot, check);
  if (
    !evidence ||
    evidence.output.status !== "classified" ||
    evidence.output.decision.action !== "match"
  )
    return null;
  const { decision } = evidence.output;
  const assessment = assessExistingBottleMatch({
    currentBottleId: lot.bottleId,
    suggestedBottleId: decision.matchedBottleId,
    candidates: evidence.artifacts.candidates,
    identityScope: decision.identityScope,
    sourceBottleIdentity: lot.sourceBottleIdentity,
    hasUnresolvedRisks:
      !decision.confidenceBasis ||
      decision.confidenceBasis.unresolvedRisks.length > 0,
    webEvidence: decision.confidenceBasis?.webEvidence,
    readListingImage: evidence.artifacts.extractedIdentitySource === "image",
    sourceLabel: "the auction's bottle facts",
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
