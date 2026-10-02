import { deriveAutomationTier } from "@peated/bottle-classifier/automationTier";
import { getBottleFieldConflicts } from "@peated/bottle-classifier/fieldConflicts";
import type {
  BottleCandidate,
  BottleClassificationDecision,
  BottleExtractedDetails,
} from "@peated/bottle-classifier/internal/types";

/** Bottle resolution owns these rules for every source; callers own permissions and saved state. */
export function assessBottleResolution({
  decision,
  candidates = [],
  currentBottleId = null,
  sourceBottleIdentity = null,
  readListingImage = false,
  allowReplacement = false,
}: {
  decision: BottleClassificationDecision;
  candidates?: BottleCandidate[];
  currentBottleId?: number | null;
  sourceBottleIdentity?: BottleExtractedDetails | null;
  readListingImage?: boolean;
  // An explicit moderator correction can replace an assignment; ingestion cannot.
  allowReplacement?: boolean;
}) {
  if (decision.action === "no_match")
    return { automationEligible: false, automationBlockers: [] };

  const target =
    decision.action === "match"
      ? candidates.find(({ bottleId }) => bottleId === decision.matchedBottleId)
      : decision.proposedBottle;
  if (!target)
    return {
      automationEligible: false,
      automationBlockers: [
        "the matched Bottle was not among the reviewed candidates",
      ],
    };
  const automationBlockers: string[] = [];
  const conflicts = getBottleFieldConflicts(sourceBottleIdentity, target);
  if (conflicts.length)
    automationBlockers.push(
      `conflicts with the source's bottle facts (${conflicts.join(", ")})`,
    );
  const replacesCurrentAssignment =
    decision.action === "match" &&
    currentBottleId !== null &&
    currentBottleId !== decision.matchedBottleId &&
    !allowReplacement;
  const hasUnresolvedRisks =
    (decision.confidenceBasis?.unresolvedRisks.length ?? 0) > 0;
  const tier = deriveAutomationTier({
    actionRiskClass: decision.action === "match" ? "match" : "create",
    hasUnresolvedRisks,
    webEvidence: decision.confidenceBasis?.webEvidence,
    hasMatchTarget: true,
    reaffirmsCurrentAssignment:
      decision.action === "match" &&
      currentBottleId === decision.matchedBottleId,
    replacesCurrentAssignment,
    hasDeterministicAnchor:
      decision.identityScope === "exact_cask" ||
      (decision.action === "create_bottle" &&
        Boolean(
          sourceBottleIdentity?.brand?.trim() &&
          sourceBottleIdentity.expression?.trim() &&
          sourceBottleIdentity.category &&
          !conflicts.length,
        )),
    hasPrimaryLabelOrImageEvidence: readListingImage,
  });
  if (tier === "review")
    automationBlockers.push(
      hasUnresolvedRisks
        ? "the classifier reported unresolved risks"
        : replacesCurrentAssignment
          ? "it replaces the listing's current Bottle"
          : "the classifier found no supporting evidence",
    );
  return {
    automationEligible: automationBlockers.length === 0,
    automationBlockers,
  };
}
