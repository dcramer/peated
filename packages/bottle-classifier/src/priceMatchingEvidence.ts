import type {
  BottleCandidate,
  BottleEvidenceCheck,
  BottleEvidenceSourceTier,
  BottleExtractedDetails,
  BottleSearchEvidence,
} from "./classifierTypes";
import {
  classifySearchResultSource,
  containsComparablePhrase,
  escapeRegExp,
  getAbvSupportLevel,
  getSearchResultText,
  listMatchesExpectedValue,
  normalizeComparableText,
  textsOverlap,
} from "./identityEvidenceCore";

// Shared bottle-identity evidence checks for classifier and price matching.

type EvidenceCheck = BottleEvidenceCheck;
type MatchAttribute = EvidenceCheck["attribute"];
type SourceTier = BottleEvidenceSourceTier;
export type WebEvidenceJudgment =
  | "not_needed"
  | "not_used"
  | "supportive"
  | "weak"
  | "conflicting"
  | null
  | undefined;
type ExistingMatchWebEvidenceEvaluation = {
  checks: EvidenceCheck[];
  differentiatingAttributes: MatchAttribute[];
  hasSupportiveWebEvidence: boolean;
};

export const REAFFIRMED_EXISTING_MATCH_VERIFICATION_CONFIDENCE_THRESHOLD = 80;
export const UNMATCHED_BOTTLE_MATCH_VERIFICATION_CONFIDENCE_THRESHOLD = 96;
export const EXACT_CASK_MATCH_VERIFICATION_CONFIDENCE_THRESHOLD = 95;
type BottleIdentityScope = "product" | "exact_cask";
const SPECIFIC_IDENTITY_WEB_SUPPORT_ATTRIBUTES = new Set<MatchAttribute>([
  "bottler",
  "name",
  "series",
  "edition",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
]);
const PLAIN_AGE_IGNORABLE_NAME_TOKENS = new Set([
  "aged",
  "american",
  "and",
  "bottle",
  "canadian",
  "cl",
  "irish",
  "japanese",
  "kentucky",
  "l",
  "malt",
  "ml",
  "of",
  "old",
  "scotch",
  "single",
  "spirit",
  "spirits",
  "straight",
  "the",
  "whiskey",
  "whisky",
  "year",
  "years",
  "yr",
  "yrs",
]);
const TITLE_IGNORABLE_NAME_TOKENS = new Set([
  ...PLAIN_AGE_IGNORABLE_NAME_TOKENS,
  "official",
  "oz",
  "website",
  "whiskies",
  "world",
]);

export function isExistingMatchConfidenceEligibleForVerification({
  confidence,
  currentBottleId,
  currentReleaseId,
  identityScope = "product",
  matchedBottleId,
  matchedReleaseId,
}: {
  confidence: number;
  currentBottleId?: null | number;
  currentReleaseId?: null | number;
  identityScope?: BottleIdentityScope | null;
  matchedBottleId: null | number;
  matchedReleaseId?: null | number;
}): boolean {
  // Downstream existing-match verification should be a thin confidence gate.
  // Exact/title/web evidence should affect classifier confidence upstream rather
  // than being re-implemented as separate approval heuristics.
  if (matchedBottleId === null) {
    return false;
  }

  const reaffirmsCurrentAssignment =
    currentBottleId != null &&
    matchedBottleId === currentBottleId &&
    (matchedReleaseId ?? null) === (currentReleaseId ?? null);

  if (reaffirmsCurrentAssignment) {
    return (
      confidence >= REAFFIRMED_EXISTING_MATCH_VERIFICATION_CONFIDENCE_THRESHOLD
    );
  }

  // Replacing an existing assignment is a downstream correction, not an
  // existing-match verification candidate.
  if (currentBottleId != null) {
    return false;
  }

  if (matchedReleaseId !== null && matchedReleaseId !== undefined) {
    return false;
  }

  if (identityScope === "exact_cask") {
    return confidence >= EXACT_CASK_MATCH_VERIFICATION_CONFIDENCE_THRESHOLD;
  }

  return confidence >= UNMATCHED_BOTTLE_MATCH_VERIFICATION_CONFIDENCE_THRESHOLD;
}

// Code-derived automation tier. Automated consumers (price scraping, ingestion)
// derive whether a classifier decision may act automatically from the action's
// risk class and the structured evidence the agent asserts, instead of reading
// the numeric `confidence` score. See
// `docs/architecture/bottle-classifier.md` (Determinism) and
// `openspec/changes/define-bottle-classifier-agent-contract/design.md`
// ("Remove numeric confidence; consumers derive gating from evidence"). User
// driven flows (Add Bottle) need no tier because the user confirms the outcome.
export type AutomationTier = "auto" | "review";

export const AUTOMATION_ACTION_RISK_CLASSES = [
  "match",
  "create",
  "repair",
  "none",
] as const;
export type AutomationActionRiskClass =
  (typeof AUTOMATION_ACTION_RISK_CLASSES)[number];

// Interim `confidenceBasis.band`. The agent still emits a band while the numeric
// score is being retired; a later pass (tasks.md 4.3) removes the read entirely
// and expresses the veto as a typed unresolved risk.
export type AutomationConfidenceBand =
  | "low"
  | "review"
  | "auto_verification"
  | "current_assignment"
  | null
  | undefined;

export type AutomationTierInput = {
  // Risk class of the classifier action. Callers map their own action
  // vocabulary (agent enum or price-match enum) onto this shared class.
  actionRiskClass: AutomationActionRiskClass;
  // Model veto: any asserted unresolved risk forces review (design.md model
  // veto scenario). Callers pass whether the risk list is non-empty.
  hasUnresolvedRisks: boolean;
  // Downgrade-only band veto (interim). See `bandForcesReview`.
  band: AutomationConfidenceBand;
  // How web/source evidence affected the decision.
  webEvidence: WebEvidenceJudgment;
  // Match anchors ----------------------------------------------------------
  // Whether a concrete existing bottle/release target was selected.
  hasMatchTarget: boolean;
  // The match reaffirms the reference's current bottle/release assignment.
  reaffirmsCurrentAssignment: boolean;
  // The match replaces a *different* current assignment (a correction, not a
  // verification candidate).
  replacesCurrentAssignment: boolean;
  // A fresh (non-reaffirming) release-level match; never auto-verified.
  matchesFreshReleaseTarget: boolean;
  // An exact accepted local alias resolved the reference.
  hasExactAliasAnchor: boolean;
  // A closed-form deterministic identity anchor (SMWS exact cask, exact_cask
  // scope, or a unique plain-age structured match).
  hasDeterministicAnchor: boolean;
  // Create/repair anchors --------------------------------------------------
  // Reviewed label or image evidence is the primary support (e.g. a photo
  // scan), independent of web search.
  hasPrimaryLabelOrImageEvidence: boolean;
};

// The band is downgrade-only: it can force review but can never upgrade a
// decision that carries a model veto or fails a structural review rule. Only
// the explicit downgrade bands (`low`, `review`) force review. `auto_verification`
// and `current_assignment` do not downgrade — `current_assignment` reaffirms
// the existing assignment and design.md treats it as positive evidence — and an
// absent band carries no signal (this preserves the historical photo behavior
// of not blocking when the agent omitted a band). This band read is removed
// entirely in the confidence-removal pass (tasks.md 4.3), where the typed
// positive-evidence anchors replace it.
function bandForcesReview(band: AutomationConfidenceBand): boolean {
  return band === "low" || band === "review";
}

// Interim evidence-equivalent of the retired numeric thresholds. reviewPolicy
// caps band to "review" whenever `isExistingMatchConfidenceEligibleForVerification`
// (the numeric gate) fails and whenever a creation lacks supporting evidence, so
// a surviving `band === "auto_verification"` is a code-produced assertion that
// the retiring threshold for this risk class was met. Reading the band here
// (never the number) preserves behavioral intent during the interim; it is
// dropped from the anchor set in tasks.md 4.3 once typed positive evidence
// lands. The band never overrides the model veto or the structural review rules
// checked before it, so it can only ever permit auto, never force one past a
// risk or a correction.
function bandAssertsAutoVerification(band: AutomationConfidenceBand): boolean {
  return band === "auto_verification";
}

function deriveMatchTier(input: AutomationTierInput): AutomationTier {
  if (!input.hasMatchTarget) {
    return "review";
  }

  // Replacing a different current assignment is a downstream correction, not an
  // existing-match verification (mirrors the currentBottleId guard in
  // `isExistingMatchConfidenceEligibleForVerification`).
  if (input.replacesCurrentAssignment) {
    return "review";
  }

  // Fresh release-level matches are never auto-verified from evidence alone.
  if (input.matchesFreshReleaseTarget) {
    return "review";
  }

  // Evidence-condition mapping of the retired numeric thresholds:
  //   reaffirmed (80)  -> current-assignment reaffirmation anchor
  //   exact_cask (95)  -> deterministic anchor
  //   unmatched (96)   -> supportive web evidence, an exact alias, primary
  //                       label/image evidence, or (interim) the band
  //                       auto_verification assertion that encodes the numeric
  //                       gate having passed.
  const hasMatchAnchor =
    input.reaffirmsCurrentAssignment ||
    input.hasDeterministicAnchor ||
    input.hasExactAliasAnchor ||
    input.hasPrimaryLabelOrImageEvidence ||
    input.webEvidence === "supportive" ||
    bandAssertsAutoVerification(input.band);

  return hasMatchAnchor ? "auto" : "review";
}

function deriveCreateOrRepairTier(input: AutomationTierInput): AutomationTier {
  // Creates and repairs require corroborating evidence: supportive web
  // evidence, a closed-form deterministic anchor, or reviewed label/image
  // primary evidence. This matches the existing creation-automation contract
  // (reviewPolicy `capUnverifiedCreationAutomation`, which is exactly what caps
  // band to "review" when that evidence is missing).
  const hasCreationEvidence =
    input.webEvidence === "supportive" ||
    input.hasDeterministicAnchor ||
    input.hasPrimaryLabelOrImageEvidence ||
    bandAssertsAutoVerification(input.band);

  return hasCreationEvidence ? "auto" : "review";
}

/**
 * Derives whether an automated flow may act on a classifier decision without
 * human review. Pure and deterministic: identical inputs always yield the same
 * tier. Never reads a numeric confidence score.
 */
export function deriveAutomationTier(
  input: AutomationTierInput,
): AutomationTier {
  // Model veto (design.md "Model veto forces review"): any unresolved risk,
  // including an uncategorizable holistic concern, forces review regardless of
  // anchors.
  if (input.hasUnresolvedRisks) {
    return "review";
  }

  // Downgrade-only band veto (interim; removed in tasks.md 4.3).
  if (bandForcesReview(input.band)) {
    return "review";
  }

  switch (input.actionRiskClass) {
    case "match":
      return deriveMatchTier(input);
    case "create":
    case "repair":
      return deriveCreateOrRepairTier(input);
    default:
      return "review";
  }
}

// Maps the agent decision action enum onto the shared automation risk class.
export function agentActionRiskClass(
  action:
    | "match"
    | "create_bottle"
    | "create_release"
    | "create_bottle_and_release"
    | "repair_parent_and_create_release"
    | "repair_bottle"
    | "no_match",
): AutomationActionRiskClass {
  switch (action) {
    case "match":
      return "match";
    case "create_bottle":
    case "create_release":
    case "create_bottle_and_release":
      return "create";
    case "repair_bottle":
    case "repair_parent_and_create_release":
      return "repair";
    default:
      return "none";
  }
}

function getTargetNameVariants(targetCandidate: BottleCandidate): string[] {
  return Array.from(
    new Set(
      [
        targetCandidate.alias,
        targetCandidate.bottleFullName,
        targetCandidate.fullName,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function getComparableNameTokens(value: string | null | undefined): string[] {
  return normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0);
}

function nameMarketsStatedAge({
  name,
  statedAge,
}: {
  name: string | null | undefined;
  statedAge: number | null | undefined;
}): boolean {
  if (!name || statedAge === null || statedAge === undefined) {
    return false;
  }

  const normalizedName = normalizeComparableText(name);

  return new RegExp(
    `\\b${escapeRegExp(String(statedAge))}(?:\\s|-)?(?:year|yr)s?(?:\\s|-)?old\\b|\\b${escapeRegExp(String(statedAge))}(?:\\s|-)?(?:year|yr)s?\\b|\\b${escapeRegExp(String(statedAge))}(?:\\s|-)?y(?:\\.?o\\.?)?\\b`,
    "i",
  ).test(normalizedName);
}

function targetHasDirtyParentStatedAgeConflict({
  target,
  extractedLabel,
}: {
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
}): boolean {
  if (
    !extractedLabel ||
    extractedLabel.stated_age === null ||
    target.kind === "release" ||
    target.releaseId !== null ||
    target.statedAge === null ||
    target.statedAge === extractedLabel.stated_age
  ) {
    return false;
  }

  return !getTargetNameVariants(target).some((name) =>
    nameMarketsStatedAge({
      name,
      statedAge: target.statedAge,
    }),
  );
}

function targetLooksLikePlainAgeStatementBottle(
  target: BottleCandidate,
): boolean {
  if (
    target.statedAge === null ||
    target.statedAge === undefined ||
    target.series ||
    target.edition ||
    target.releaseYear !== null ||
    target.vintageYear !== null
  ) {
    return false;
  }

  const producerTokens = new Set(
    [target.brand, target.bottler, ...target.distillery].flatMap((value) =>
      getComparableNameTokens(value),
    ),
  );
  const ageToken = String(target.statedAge);

  return getTargetNameVariants(target).some((name) => {
    if (!nameMarketsStatedAge({ name, statedAge: target.statedAge })) {
      return false;
    }

    const extraTokens = getComparableNameTokens(name).filter(
      (token) =>
        token !== ageToken &&
        !producerTokens.has(token) &&
        !PLAIN_AGE_IGNORABLE_NAME_TOKENS.has(token),
    );

    return extraTokens.length === 0;
  });
}

function titleSupportsCandidateName(
  title: string | null | undefined,
  candidateName: string,
): boolean {
  const candidateTokens = getComparableNameTokens(candidateName);
  if (!candidateTokens.length) {
    return false;
  }

  const titleTokens = getComparableNameTokens(title);
  if (!titleTokens.length) {
    return false;
  }

  const candidateSet = new Set(candidateTokens);
  const titleSet = new Set(titleTokens);

  for (const token of candidateSet) {
    if (!titleSet.has(token)) {
      return false;
    }
  }

  for (const token of titleSet) {
    if (candidateSet.has(token)) {
      continue;
    }

    if (!TITLE_IGNORABLE_NAME_TOKENS.has(token)) {
      return false;
    }
  }

  return true;
}

function extractedLabelLooksLikePlainAgeStatement(
  extractedLabel: BottleExtractedDetails | null,
): boolean {
  if (!extractedLabel) {
    return false;
  }

  return (
    extractedLabel.stated_age !== null &&
    extractedLabel.stated_age !== undefined &&
    !extractedLabel.expression &&
    !extractedLabel.series &&
    !extractedLabel.edition &&
    extractedLabel.release_year === null &&
    extractedLabel.vintage_year === null &&
    extractedLabel.cask_strength === null &&
    extractedLabel.single_cask === null &&
    extractedLabel.abv === null
  );
}

function bottleCandidateIsPlainAgeAutoVerificationTarget(
  target: BottleCandidate,
): boolean {
  return (
    target.kind !== "release" &&
    (target.releaseId ?? null) === null &&
    target.abv === null &&
    target.caskStrength !== true &&
    target.singleCask !== true &&
    targetLooksLikePlainAgeStatementBottle(target)
  );
}

function extractedLabelCarriesUnsupportedSpecificity({
  target,
  extractedLabel,
}: {
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
}): boolean {
  if (!extractedLabel) {
    return false;
  }

  return (
    Boolean(extractedLabel.edition && !target.edition) ||
    (extractedLabel.cask_strength === true && target.caskStrength === null) ||
    (extractedLabel.single_cask === true && target.singleCask === null) ||
    (extractedLabel.abv !== null && target.abv === null) ||
    (extractedLabel.vintage_year !== null && target.vintageYear === null) ||
    (extractedLabel.release_year !== null && target.releaseYear === null)
  );
}

function evidenceTextSupportsPlainAgeStatementTarget({
  text,
  target,
  extractedLabel,
}: {
  text: string | null | undefined;
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
}): boolean {
  if (
    !text ||
    !extractedLabelLooksLikePlainAgeStatement(extractedLabel) ||
    !targetLooksLikePlainAgeStatementBottle(target)
  ) {
    return false;
  }

  const normalizedText = normalizeComparableText(text);
  if (!normalizedText) {
    return false;
  }

  const producerNames = [
    extractedLabel?.brand,
    target.brand,
    ...(extractedLabel?.distillery ?? []),
    ...target.distillery,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeComparableText(value))
    .filter((value) => value.length > 0);

  if (
    !producerNames.some((value) =>
      containsComparablePhrase(normalizedText, value),
    )
  ) {
    return false;
  }

  const statedAge = extractedLabel?.stated_age;
  if (
    statedAge === null ||
    statedAge === undefined ||
    target.statedAge !== statedAge ||
    !attributeMatchesText("statedAge", String(statedAge), normalizedText)
  ) {
    return false;
  }

  const expectedCategory = normalizeComparableCategory(
    extractedLabel?.category ?? null,
  );
  if (!expectedCategory) {
    return true;
  }

  return attributeMatchesText("category", expectedCategory, normalizedText);
}

function getCategoryKeywords(value: string): string[] {
  switch (value) {
    case "single_malt":
      return ["single malt"];
    case "single_grain":
      return ["single grain"];
    case "single_pot_still":
      return ["single pot still"];
    default:
      return [value.replace(/_/g, " ")];
  }
}

// The legacy `spirit` bucket is a fallback for missing whisky category data,
// so it should not count as either supportive identity evidence or a conflict.
function normalizeComparableCategory(
  value:
    | BottleCandidate["category"]
    | BottleExtractedDetails["category"]
    | null,
) {
  return value === "spirit" ? null : value;
}

function attributeMatchesText(
  attribute: MatchAttribute,
  expectedValue: string,
  text: string,
  options: { usProofEligible?: boolean } = {},
): boolean {
  const normalizedText = normalizeComparableText(text);
  if (!normalizedText) {
    return false;
  }

  switch (attribute) {
    case "abv":
      return (
        getAbvSupportLevel(normalizedText, Number(expectedValue), options) !==
        "none"
      );
    case "caskStrength":
      return /\b(cask strength|barrel strength|barrel proof|full proof|natural strength|original strength)\b/i.test(
        normalizedText,
      );
    case "singleCask":
      return /\b(single cask|single barrel|single barrel select|single cask nation|selected cask)\b/i.test(
        normalizedText,
      );
    case "statedAge":
      return new RegExp(
        `\\b${escapeRegExp(expectedValue)}(?:\\s|-)?(?:year|yr)s?(?:\\s|-)?old\\b|\\b${escapeRegExp(expectedValue)}(?:\\s|-)?(?:year|yr)s?\\b`,
        "i",
      ).test(normalizedText);
    case "releaseYear":
    case "vintageYear":
      return new RegExp(`\\b${escapeRegExp(expectedValue)}\\b`, "i").test(
        normalizedText,
      );
    case "category":
      return getCategoryKeywords(expectedValue).some((keyword) =>
        containsComparablePhrase(
          normalizedText,
          normalizeComparableText(keyword),
        ),
      );
    default:
      return textsOverlap(normalizedText, expectedValue);
  }
}

function buildCheck(
  attribute: MatchAttribute,
  expectedValue: string | number | boolean,
  required: boolean,
): EvidenceCheck {
  return {
    attribute,
    expectedValue: String(expectedValue),
    required,
    validated: false,
    weaklySupported: false,
    matchedSourceTiers: [],
    matchedSourceUrls: [],
  };
}

function addCheckIfPresent(
  checks: EvidenceCheck[],
  attribute: MatchAttribute,
  value: string | number | boolean | null | undefined,
  required: boolean,
): void {
  if (value === null || value === undefined || value === "") {
    return;
  }

  checks.push(buildCheck(attribute, value, required));
}

function candidateMatchesBrand(
  candidate: BottleCandidate,
  brandName: string | null | undefined,
): boolean {
  if (!brandName) {
    return false;
  }

  return [candidate.brand, candidate.fullName, candidate.alias].some((value) =>
    textsOverlap(value, brandName),
  );
}

function candidateMatchesName(
  candidate: BottleCandidate,
  value: string | null | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return (
    textsOverlap(candidate.fullName, value) ||
    textsOverlap(candidate.alias, value)
  );
}

function candidateMatchesSeries(
  candidate: BottleCandidate,
  value: string | null | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return (
    textsOverlap(candidate.series, value) ||
    candidateMatchesName(candidate, value)
  );
}

function candidateMatchesBottler(
  candidate: BottleCandidate,
  value: string | null | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return textsOverlap(candidate.bottler, value);
}

function candidateMatchesDistillery(
  candidate: BottleCandidate,
  values: string[] | null | undefined,
): boolean {
  if (!values?.length) {
    return false;
  }

  return listMatchesExpectedValue(candidate.distillery, values);
}

function candidateMatchesPlainAgeStructuredIdentity({
  candidate,
  extractedLabel,
}: {
  candidate: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
}): boolean {
  return (
    Boolean(extractedLabel?.brand) &&
    candidateMatchesBrand(candidate, extractedLabel?.brand) &&
    extractedLabel?.stated_age !== null &&
    extractedLabel?.stated_age !== undefined &&
    candidate.statedAge === extractedLabel.stated_age
  );
}

function titleSupportsAnyCandidateName({
  title,
  candidate,
}: {
  title: string;
  candidate: BottleCandidate;
}): boolean {
  return getTargetNameVariants(candidate).some((variant) =>
    titleSupportsCandidateName(title, variant),
  );
}

function buildExistingMatchSupportChecks({
  target,
  extractedLabel,
}: {
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
}): {
  checks: EvidenceCheck[];
  differentiatingAttributes: MatchAttribute[];
} {
  const checks: EvidenceCheck[] = [];
  const differentiatingAttributes = new Set<MatchAttribute>();
  const label = extractedLabel;
  const comparableLabelCategory = normalizeComparableCategory(
    label?.category ?? null,
  );
  const comparableTargetCategory = normalizeComparableCategory(
    target.category ?? null,
  );

  if (label?.brand && candidateMatchesBrand(target, label.brand)) {
    addCheckIfPresent(checks, "brand", label.brand, false);
  }

  if (label?.expression && candidateMatchesName(target, label.expression)) {
    addCheckIfPresent(checks, "name", label.expression, false);
  }

  if (label?.series && candidateMatchesSeries(target, label.series)) {
    addCheckIfPresent(checks, "series", label.series, false);
  }

  if (
    label?.distillery?.length &&
    candidateMatchesDistillery(target, label.distillery)
  ) {
    for (const distillery of label.distillery) {
      addCheckIfPresent(checks, "distillery", distillery, false);
    }
  }

  if (
    comparableLabelCategory &&
    comparableTargetCategory === comparableLabelCategory
  ) {
    addCheckIfPresent(checks, "category", comparableLabelCategory, false);
  }

  if (
    label &&
    label.stated_age !== null &&
    target.statedAge === label.stated_age
  ) {
    addCheckIfPresent(checks, "statedAge", label.stated_age, false);
  }

  if (label?.edition && textsOverlap(target.edition, label.edition)) {
    addCheckIfPresent(checks, "edition", label.edition, false);
  }

  if (
    label &&
    label.cask_strength !== null &&
    target.caskStrength === label.cask_strength
  ) {
    addCheckIfPresent(checks, "caskStrength", label.cask_strength, false);
  }

  if (
    label &&
    label.single_cask !== null &&
    target.singleCask === label.single_cask
  ) {
    addCheckIfPresent(checks, "singleCask", label.single_cask, false);
  }

  if (
    label &&
    label.abv !== null &&
    target.abv !== null &&
    Math.abs(target.abv - label.abv) <= 0.3
  ) {
    addCheckIfPresent(checks, "abv", target.abv, false);
  }

  if (
    label &&
    label.vintage_year !== null &&
    target.vintageYear === label.vintage_year
  ) {
    addCheckIfPresent(checks, "vintageYear", label.vintage_year, false);
  }

  if (
    label &&
    label.release_year !== null &&
    target.releaseYear === label.release_year
  ) {
    addCheckIfPresent(checks, "releaseYear", label.release_year, false);
  }

  if (!extractedLabel?.series && target.series) {
    addCheckIfPresent(checks, "series", target.series, true);
    differentiatingAttributes.add("series");
  }

  if (!extractedLabel?.distillery?.length && target.distillery.length) {
    for (const distillery of target.distillery) {
      addCheckIfPresent(checks, "distillery", distillery, true);
    }
    differentiatingAttributes.add("distillery");
  }

  if (comparableLabelCategory === null && comparableTargetCategory) {
    addCheckIfPresent(checks, "category", comparableTargetCategory, true);
    differentiatingAttributes.add("category");
  }

  if (extractedLabel?.stated_age === null && target.statedAge !== null) {
    addCheckIfPresent(checks, "statedAge", target.statedAge, true);
    differentiatingAttributes.add("statedAge");
  }

  if (!extractedLabel?.edition && target.edition) {
    addCheckIfPresent(checks, "edition", target.edition, true);
    differentiatingAttributes.add("edition");
  }

  if (extractedLabel?.cask_strength === null && target.caskStrength) {
    addCheckIfPresent(checks, "caskStrength", true, true);
    differentiatingAttributes.add("caskStrength");
  }

  if (extractedLabel?.single_cask === null && target.singleCask) {
    addCheckIfPresent(checks, "singleCask", true, true);
    differentiatingAttributes.add("singleCask");
  }

  if (extractedLabel?.abv === null && target.abv !== null) {
    addCheckIfPresent(checks, "abv", target.abv, true);
    differentiatingAttributes.add("abv");
  }

  if (extractedLabel?.vintage_year === null && target.vintageYear !== null) {
    addCheckIfPresent(checks, "vintageYear", target.vintageYear, true);
    differentiatingAttributes.add("vintageYear");
  }

  if (extractedLabel?.release_year === null && target.releaseYear !== null) {
    addCheckIfPresent(checks, "releaseYear", target.releaseYear, true);
    differentiatingAttributes.add("releaseYear");
  }

  return {
    checks,
    differentiatingAttributes: Array.from(differentiatingAttributes),
  };
}

function evaluateSearchEvidenceChecks({
  checks,
  searchEvidence,
  sourceUrl,
  webEvidenceJudgment,
}: {
  checks: EvidenceCheck[];
  searchEvidence: BottleSearchEvidence[];
  sourceUrl: string;
  webEvidenceJudgment: WebEvidenceJudgment;
}): EvidenceCheck[] {
  if (!checks.length || !searchEvidence.length) {
    return checks;
  }

  const usProofEligible = checks.some(
    (check) =>
      check.attribute === "category" && check.expectedValue === "bourbon",
  );

  return checks.map((check) => {
    const matchedSourceTiers = new Set<SourceTier>();
    const matchedSourceUrls = new Set<string>();

    for (const evidence of searchEvidence) {
      for (const result of evidence.results) {
        const text = getSearchResultText(evidence, result);
        if (
          !attributeMatchesText(check.attribute, check.expectedValue, text, {
            usProofEligible,
          })
        ) {
          continue;
        }

        const sourceTier = classifySearchResultSource({
          result,
          sourceUrl,
        });
        matchedSourceTiers.add(sourceTier);
        matchedSourceUrls.add(result.url);
      }
    }

    const tiers = Array.from(matchedSourceTiers);
    const validated =
      webEvidenceJudgment === "supportive" && tiers.includes("external");
    const weaklySupported = !validated && tiers.length > 0;

    return {
      ...check,
      validated,
      weaklySupported,
      matchedSourceTiers: tiers,
      matchedSourceUrls: Array.from(matchedSourceUrls),
    };
  });
}

export function hasSupportiveWebEvidenceForExistingMatch({
  sourceUrl,
  target,
  extractedLabel,
  searchEvidence,
  webEvidenceJudgment,
}: {
  sourceUrl: string;
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
  searchEvidence: BottleSearchEvidence[];
  webEvidenceJudgment?: WebEvidenceJudgment;
}): boolean {
  return evaluateExistingMatchWebEvidence({
    sourceUrl,
    target,
    extractedLabel,
    searchEvidence,
    webEvidenceJudgment,
  }).hasSupportiveWebEvidence;
}

export function hasExternalTargetIdentityEvidenceForExistingMatch({
  sourceUrl,
  target,
  extractedLabel,
  searchEvidence,
  webEvidenceJudgment,
}: {
  sourceUrl: string;
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
  searchEvidence: BottleSearchEvidence[];
  webEvidenceJudgment?: WebEvidenceJudgment;
}): boolean {
  if (webEvidenceJudgment !== "supportive") {
    return false;
  }

  const targetNameVariants = getTargetNameVariants(target);

  return searchEvidence.some((evidence) =>
    evidence.results.some((result) => {
      const sourceTier = classifySearchResultSource({
        result,
        sourceUrl,
      });

      if (sourceTier !== "external") {
        return false;
      }

      return (
        targetNameVariants.some((variant) =>
          titleSupportsCandidateName(result.title, variant),
        ) ||
        evidenceTextSupportsPlainAgeStatementTarget({
          text: getSearchResultText(evidence, result),
          target,
          extractedLabel,
        })
      );
    }),
  );
}

export function isPlainAgeBottleMatchEligibleForVerification({
  target,
  candidates,
  extractedLabel,
  referenceName,
}: {
  target: BottleCandidate;
  candidates: BottleCandidate[];
  extractedLabel: BottleExtractedDetails | null;
  referenceName: string;
}): boolean {
  if (
    !extractedLabelLooksLikePlainAgeStatement(extractedLabel) ||
    !bottleCandidateIsPlainAgeAutoVerificationTarget(target) ||
    !candidateMatchesPlainAgeStructuredIdentity({
      candidate: target,
      extractedLabel,
    }) ||
    !titleSupportsAnyCandidateName({ title: referenceName, candidate: target })
  ) {
    return false;
  }

  return !candidates.some(
    (candidate) =>
      candidate.bottleId !== target.bottleId &&
      candidate.kind !== "release" &&
      (candidate.releaseId ?? null) === null &&
      candidateMatchesPlainAgeStructuredIdentity({
        candidate,
        extractedLabel,
      }) &&
      titleSupportsAnyCandidateName({ title: referenceName, candidate }),
  );
}

export function evaluateExistingMatchWebEvidence({
  sourceUrl,
  target,
  extractedLabel,
  searchEvidence,
  webEvidenceJudgment,
}: {
  sourceUrl: string;
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
  searchEvidence: BottleSearchEvidence[];
  webEvidenceJudgment?: WebEvidenceJudgment;
}): ExistingMatchWebEvidenceEvaluation {
  const { checks, differentiatingAttributes } = buildExistingMatchSupportChecks(
    {
      target,
      extractedLabel,
    },
  );

  if (!checks.length || !searchEvidence.length) {
    return {
      checks,
      differentiatingAttributes,
      hasSupportiveWebEvidence: false,
    };
  }

  const evaluatedChecks = evaluateSearchEvidenceChecks({
    checks,
    searchEvidence,
    sourceUrl,
    webEvidenceJudgment,
  });
  const unsupportedResult = {
    checks: evaluatedChecks,
    differentiatingAttributes,
    hasSupportiveWebEvidence: false,
  };
  const supportedChecks = evaluatedChecks.filter((check) => check.validated);

  if (!supportedChecks.length) {
    return unsupportedResult;
  }

  const hasBaseIdentitySupport = supportedChecks.some((check) =>
    ["brand", "name", "series", "distillery", "bottler"].includes(
      check.attribute,
    ),
  );

  if (!hasBaseIdentitySupport) {
    return unsupportedResult;
  }

  const hasSpecificIdentitySupport = supportedChecks.some((check) =>
    SPECIFIC_IDENTITY_WEB_SUPPORT_ATTRIBUTES.has(check.attribute),
  );

  if (
    differentiatingAttributes.includes("statedAge") &&
    !hasSpecificIdentitySupport
  ) {
    return unsupportedResult;
  }

  if (
    extractedLabelCarriesUnsupportedSpecificity({ target, extractedLabel }) &&
    !hasSpecificIdentitySupport
  ) {
    return unsupportedResult;
  }

  if (
    extractedLabelLooksLikePlainAgeStatement(extractedLabel) &&
    !targetLooksLikePlainAgeStatementBottle(target) &&
    !hasSpecificIdentitySupport
  ) {
    return unsupportedResult;
  }

  const requiredSpecificityAttributes = differentiatingAttributes.filter(
    (attribute) =>
      attribute === "edition" ||
      attribute === "releaseYear" ||
      attribute === "vintageYear",
  );

  if (
    requiredSpecificityAttributes.some(
      (attribute) =>
        !supportedChecks.some((check) => check.attribute === attribute),
    )
  ) {
    return unsupportedResult;
  }

  if (!differentiatingAttributes.length) {
    return {
      checks: evaluatedChecks,
      differentiatingAttributes,
      hasSupportiveWebEvidence: true,
    };
  }

  return {
    checks: evaluatedChecks,
    differentiatingAttributes,
    hasSupportiveWebEvidence: supportedChecks.some((check) =>
      differentiatingAttributes.includes(check.attribute),
    ),
  };
}

export function getExistingMatchIdentityConflicts({
  target,
  extractedLabel,
}: {
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
}): string[] {
  if (!extractedLabel) {
    return [];
  }

  const conflicts: string[] = [];
  const comparableExtractedCategory = normalizeComparableCategory(
    extractedLabel.category ?? null,
  );
  const comparableTargetCategory = normalizeComparableCategory(
    target.category ?? null,
  );

  if (
    extractedLabel.bottler &&
    target.bottler &&
    !candidateMatchesBottler(target, extractedLabel.bottler)
  ) {
    conflicts.push("candidate bottler conflicts with extracted label");
  }

  if (
    extractedLabel.series &&
    target.series &&
    !candidateMatchesSeries(target, extractedLabel.series)
  ) {
    conflicts.push("candidate series conflicts with extracted label");
  }

  if (
    extractedLabel.distillery?.length &&
    target.distillery.length &&
    !candidateMatchesDistillery(target, extractedLabel.distillery)
  ) {
    conflicts.push("candidate distillery conflicts with extracted label");
  }

  if (
    comparableExtractedCategory &&
    comparableTargetCategory &&
    comparableTargetCategory !== comparableExtractedCategory
  ) {
    conflicts.push("candidate category conflicts with extracted label");
  }

  if (
    extractedLabel.stated_age !== null &&
    target.statedAge !== null &&
    target.statedAge !== extractedLabel.stated_age &&
    !targetHasDirtyParentStatedAgeConflict({
      target,
      extractedLabel,
    })
  ) {
    conflicts.push("candidate age conflicts with extracted label");
  }

  if (
    extractedLabel.edition &&
    target.edition &&
    !textsOverlap(target.edition, extractedLabel.edition)
  ) {
    conflicts.push("candidate edition conflicts with extracted label");
  }

  if (
    extractedLabel.cask_strength !== null &&
    target.caskStrength !== null &&
    target.caskStrength !== extractedLabel.cask_strength
  ) {
    conflicts.push(
      "candidate cask-strength flag conflicts with extracted label",
    );
  }

  if (
    extractedLabel.single_cask !== null &&
    target.singleCask !== null &&
    target.singleCask !== extractedLabel.single_cask
  ) {
    conflicts.push("candidate single-cask flag conflicts with extracted label");
  }

  if (extractedLabel.abv !== null && target.abv !== null) {
    const difference = Math.abs(target.abv - extractedLabel.abv);
    if (difference >= 1) {
      conflicts.push("candidate ABV materially conflicts with extracted label");
    }
  }

  if (
    extractedLabel.vintage_year !== null &&
    target.vintageYear !== null &&
    target.vintageYear !== extractedLabel.vintage_year
  ) {
    conflicts.push("candidate vintage year conflicts with extracted label");
  }

  if (
    extractedLabel.release_year !== null &&
    target.releaseYear !== null &&
    target.releaseYear !== extractedLabel.release_year
  ) {
    conflicts.push("candidate release year conflicts with extracted label");
  }

  return Array.from(new Set(conflicts));
}
