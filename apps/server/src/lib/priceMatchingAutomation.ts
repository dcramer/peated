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

export type { StorePriceMatchAutomationAssessment };

type MatchAction = "match_existing" | "correction" | "create_new" | "no_match";

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

  const isCreate = action === "create_new";
  const target = isCreate
    ? proposedBottle
    : (candidates.find(({ bottleId }) => bottleId === suggestedBottleId) ??
      null);
  const automationBlockers: string[] = [];
  if (!target) {
    automationBlockers.push(
      isCreate
        ? "the classifier returned no Bottle to create"
        : "the matched Bottle was not among the reviewed candidates",
    );
    return { automationEligible: false, automationBlockers };
  }

  const sourceConflicts = getBottleFieldConflicts(sourceBottleIdentity, target);
  if (sourceConflicts.length) {
    automationBlockers.push(
      `conflicts with the store's product facts (${sourceConflicts.join(", ")})`,
    );
  }

  const reaffirmsCurrentAssignment =
    !isCreate &&
    price.bottleId !== null &&
    price.bottleId === suggestedBottleId;
  const replacesCurrentAssignment =
    !isCreate && price.bottleId !== null && !reaffirmsCurrentAssignment;
  const tier = deriveAutomationTier({
    actionRiskClass: isCreate ? "create" : "match",
    hasUnresolvedRisks,
    webEvidence: webEvidence ?? null,
    hasMatchTarget: true,
    reaffirmsCurrentAssignment,
    replacesCurrentAssignment,
    hasDeterministicAnchor:
      identityScope === "exact_cask" ||
      (isCreate &&
        hasCompleteSourceIdentity(sourceBottleIdentity) &&
        !sourceConflicts.length),
    hasPrimaryLabelOrImageEvidence: readListingImage,
  });
  if (tier === "review") {
    automationBlockers.push(
      hasUnresolvedRisks
        ? "the classifier reported unresolved risks"
        : replacesCurrentAssignment
          ? "it replaces the listing's current Bottle"
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
