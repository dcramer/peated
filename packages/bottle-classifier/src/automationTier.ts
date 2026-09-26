export type WebEvidenceJudgment =
  | "not_needed"
  | "not_used"
  | "supportive"
  | "weak"
  | "conflicting"
  | null
  | undefined;

/**
 * Whether an automated flow may apply a classifier decision without a person.
 * See `docs/architecture/bottle-classifier.md` (Deterministic Code). Flows
 * where a person confirms the outcome, such as Add Bottle, need no tier.
 */
export type AutomationTier = "auto" | "review";

export type AutomationActionRiskClass = "match" | "create" | "none";

export type AutomationTierInput = {
  actionRiskClass: AutomationActionRiskClass;
  // Any unresolved risk the agent reported.
  hasUnresolvedRisks: boolean;
  // The agent's judgment of the web evidence.
  webEvidence: WebEvidenceJudgment;
  // A concrete existing Bottle was selected.
  hasMatchTarget: boolean;
  // The match keeps the source's current Bottle.
  reaffirmsCurrentAssignment: boolean;
  // The match would replace a different current Bottle.
  replacesCurrentAssignment: boolean;
  // A closed identifier, such as an SMWS code, or complete structured facts.
  hasDeterministicAnchor: boolean;
  // The facts were read from the product's own label or photo.
  hasPrimaryLabelOrImageEvidence: boolean;
};

function deriveMatchTier(input: AutomationTierInput): AutomationTier {
  if (!input.hasMatchTarget || input.replacesCurrentAssignment) {
    return "review";
  }

  // `not_needed` is the agent saying local or label evidence settles the
  // match. `not_used` only says the web was not consulted, so it is no anchor.
  const hasMatchAnchor =
    input.reaffirmsCurrentAssignment ||
    input.hasDeterministicAnchor ||
    input.hasPrimaryLabelOrImageEvidence ||
    input.webEvidence === "supportive" ||
    input.webEvidence === "not_needed";

  return hasMatchAnchor ? "auto" : "review";
}

function deriveCreateTier(input: AutomationTierInput): AutomationTier {
  // A new Bottle needs concrete support; `not_needed` is not enough.
  const hasCreationEvidence =
    input.webEvidence === "supportive" ||
    input.hasDeterministicAnchor ||
    input.hasPrimaryLabelOrImageEvidence;

  return hasCreationEvidence ? "auto" : "review";
}

/** Any unresolved risk forces review; otherwise the action needs an anchor. */
export function deriveAutomationTier(
  input: AutomationTierInput,
): AutomationTier {
  if (input.hasUnresolvedRisks) {
    return "review";
  }

  switch (input.actionRiskClass) {
    case "match":
      return deriveMatchTier(input);
    case "create":
      return deriveCreateTier(input);
    case "none":
      return "review";
  }
}

export function agentActionRiskClass(
  action: "match" | "create_bottle" | "no_match",
): AutomationActionRiskClass {
  switch (action) {
    case "match":
      return "match";
    case "create_bottle":
      return "create";
    case "no_match":
      return "none";
  }
}
