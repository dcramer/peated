import {
  deriveAutomationTier,
  type WebEvidenceJudgment,
} from "@peated/bottle-classifier/automationTier";
import { getBottleFieldConflicts } from "@peated/bottle-classifier/fieldConflicts";
import type {
  BottleCandidate,
  BottleExtractedDetails,
} from "@peated/bottle-classifier/internal/types";

/** Matching owns this gate: code may reject a model's choice, never choose another Bottle. */
export function assessExistingBottleMatch({
  currentBottleId,
  suggestedBottleId,
  candidates,
  identityScope,
  sourceBottleIdentity,
  hasUnresolvedRisks,
  webEvidence,
  readListingImage,
  sourceLabel,
}: {
  currentBottleId: number | null;
  suggestedBottleId: number | null;
  candidates: BottleCandidate[];
  identityScope: "product" | "exact_cask";
  sourceBottleIdentity: BottleExtractedDetails | null;
  hasUnresolvedRisks: boolean;
  webEvidence: WebEvidenceJudgment;
  readListingImage: boolean;
  sourceLabel: string;
}) {
  const target = candidates.find(
    ({ bottleId }) => bottleId === suggestedBottleId,
  );
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
      `conflicts with ${sourceLabel} (${conflicts.join(", ")})`,
    );
  const replacesCurrentAssignment =
    currentBottleId !== null && currentBottleId !== suggestedBottleId;
  const tier = deriveAutomationTier({
    actionRiskClass: "match",
    hasUnresolvedRisks,
    webEvidence: webEvidence ?? null,
    hasMatchTarget: true,
    reaffirmsCurrentAssignment:
      currentBottleId !== null && currentBottleId === suggestedBottleId,
    replacesCurrentAssignment,
    hasDeterministicAnchor: identityScope === "exact_cask",
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
