import {
  deriveAutomationTier,
  type WebEvidenceJudgment,
} from "@peated/bottle-classifier/automationTier";
import { getBottleFieldConflicts } from "@peated/bottle-classifier/fieldConflicts";
import type {
  BottleCandidate,
  BottleExtractedDetails,
  ProposedBottle,
} from "@peated/bottle-classifier/internal/types";
import type { StorePrice } from "@peated/server/db/schema";
import type { StorePriceMatchAutomationAssessment } from "@peated/server/schemas";
import { assessExistingBottleMatch } from "./bottleMatchingAutomation";

export type { StorePriceMatchAutomationAssessment };

type MatchAction = "match" | "create_bottle" | "no_match";

/**
 * Store-price automation rule (owner: store-price matching). The classifier
 * decides identity. This only decides whether its decision may apply without a
 * moderator, using the same tier as photo creation (`deriveAutomationTier`).
 * Code adds one check of its own: the chosen Bottle must not contradict facts
 * the scraper supplied as structured fields.
 */
export function assessStorePriceMatch({
  action,
  price,
  suggestedBottleId,
  candidates,
  proposedBottle,
  identityScope,
  sourceBottleIdentity,
  hasUnresolvedRisks,
  webEvidence,
  readListingImage,
}: {
  action: MatchAction;
  price: Pick<StorePrice, "bottleId">;
  suggestedBottleId: number | null;
  candidates: BottleCandidate[];
  proposedBottle: ProposedBottle | null;
  identityScope: "product" | "exact_cask";
  sourceBottleIdentity: BottleExtractedDetails | null;
  hasUnresolvedRisks: boolean;
  webEvidence: WebEvidenceJudgment;
  // The classifier read the facts from the listing's own label image.
  readListingImage: boolean;
}): StorePriceMatchAutomationAssessment {
  if (action === "no_match") {
    return { automationEligible: false, automationBlockers: [] };
  }

  if (action === "match")
    return assessExistingBottleMatch({
      currentBottleId: price.bottleId,
      suggestedBottleId,
      candidates,
      identityScope,
      sourceBottleIdentity,
      hasUnresolvedRisks,
      webEvidence,
      readListingImage,
      sourceLabel: "the store's product facts",
    });

  const target = proposedBottle;
  const automationBlockers: string[] = [];
  if (!target) {
    automationBlockers.push("the classifier returned no Bottle to create");
    return { automationEligible: false, automationBlockers };
  }

  const sourceConflicts = getBottleFieldConflicts(sourceBottleIdentity, target);
  if (sourceConflicts.length) {
    automationBlockers.push(
      `conflicts with the store's product facts (${sourceConflicts.join(", ")})`,
    );
  }

  const tier = deriveAutomationTier({
    actionRiskClass: "create",
    hasUnresolvedRisks,
    webEvidence: webEvidence ?? null,
    hasMatchTarget: true,
    reaffirmsCurrentAssignment: false,
    replacesCurrentAssignment: false,
    hasDeterministicAnchor:
      identityScope === "exact_cask" ||
      (hasCompleteSourceIdentity(sourceBottleIdentity) &&
        !sourceConflicts.length),
    hasPrimaryLabelOrImageEvidence: readListingImage,
  });
  if (tier === "review") {
    automationBlockers.push(
      hasUnresolvedRisks
        ? "the classifier reported unresolved risks"
        : "the classifier found no supporting evidence",
    );
  }

  return {
    automationEligible: automationBlockers.length === 0,
    automationBlockers,
  };
}

/** A scraper's structured facts name a whole Bottle when they have these. */
function hasCompleteSourceIdentity(identity: BottleExtractedDetails | null) {
  return Boolean(
    identity?.brand?.trim() && identity.expression?.trim() && identity.category,
  );
}
