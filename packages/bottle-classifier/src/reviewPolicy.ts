import {
  getExistingMatchIdentityConflicts,
  hasDirtyParentStatedAgeConflict,
  hasSupportiveWebEvidenceForExistingMatch,
} from "./bottleClassificationEvidence";
import { normalizeBottleCreationDrafts } from "./bottleCreationDrafts";
import {
  BottleClassificationDecisionSchema,
  type BottleCandidate,
  type BottleClassificationDecision,
  type BottleClassifierAgentDecision,
  type BottleObservation,
  type EntityResolution,
  type ProposedRelease,
} from "./classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "./contract";
import { BottleClassificationError } from "./error";
import { normalizeString } from "./normalize";

const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const GIFT_SET_PACKAGING_KEYWORDS =
  /\b(gift set|gift pack|gift box|holiday pack|with glass|with glasses|glassware)\b/i;
const WHISKY_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;
const GENERIC_NAME_TOKENS = new Set([
  "american",
  "and",
  "bottle",
  "bourbon",
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
  "oz",
  "rye",
  "scotch",
  "single",
  "spirit",
  "spirits",
  "straight",
  "the",
  "whiskey",
  "whisky",
  "world",
  "year",
  "years",
  "yr",
  "yrs",
]);
const STANDALONE_ARTICLE_TOKENS = new Set(["a"]);
const STANDALONE_ARTICLE_BLOCKERS = new Set([
  "batch",
  "edition",
  "release",
  "vintage",
  "series",
  "cask",
  "barrel",
  "lot",
  "chapter",
  "part",
  "volume",
]);
const GIFT_SET_PACKAGING_TOKENS = new Set([
  "box",
  "gift",
  "glass",
  "glasses",
  "glassware",
  "holiday",
  "pack",
  "set",
  "unknown",
  "with",
]);
const EXACT_CASK_PROGRAM_BRANDS = new Set([
  "scotch malt whisky society",
  "smws",
  "the scotch malt whisky society",
]);
const EXACT_CASK_NUMBER_PATTERNS = [
  /\bcask no\.?\b/i,
  /\bbarrel no\.?\b/i,
] as const;
const EXACT_CASK_ALPHA_NUMERIC_CODE_PATTERN = /\b[a-z]{1,4}\d+\.\d+\b/i;
const EXACT_CASK_NUMERIC_CODE_PATTERN = /\b\d+\.\d+\b/g;
const LEGACY_RELEASE_LIKE_NAME_PATTERNS = [
  /\bbatch(?:\s*(?:no\.?|number|#))?\s*[a-z0-9.-]+\b/i,
  /\b\d{4}\s+release\b/i,
  /\b\d{4}\s+vintage\b/i,
  /\b\d+(?:st|nd|rd|th)\s+edition\b/i,
] as const;

function normalizeClassifierConfidence(confidence: number): number {
  const percentageConfidence = confidence <= 1 ? confidence * 100 : confidence;
  return Math.min(100, Math.max(0, Math.round(percentageConfidence)));
}

function appendRationale(
  rationale: string | null,
  addition: string,
): string | null {
  return rationale ? `${rationale} ${addition}` : addition;
}

function normalizeEntityChoiceName(name: string): string {
  return normalizeString(name).toLowerCase();
}

function normalizeComparableText(value: string | null | undefined): string {
  return normalizeString(value ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsComparablePhrase(haystack: string, needle: string): boolean {
  if (!haystack || !needle) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`,
  );

  return pattern.test(haystack);
}

function textsOverlap(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    containsComparablePhrase(normalizedLeft, normalizedRight) ||
    containsComparablePhrase(normalizedRight, normalizedLeft)
  );
}

const BARE_SMWS_CODE_REFERENCE_PATTERN = /^SMWS\s+([A-Z]*\d+\.\d+)$/i;

function isSmwsIdentityAnchor(value: string | null | undefined): boolean {
  const normalizedValue = normalizeComparableText(value);
  return (
    normalizedValue === "smws" ||
    normalizedValue === "the scotch malt whisky society" ||
    normalizedValue === "scotch malt whisky society"
  );
}

function getBareSmwsCodeReference(
  referenceName: string | null | undefined,
): string | null {
  const match = normalizeString(referenceName ?? "")
    .trim()
    .match(BARE_SMWS_CODE_REFERENCE_PATTERN);

  return match?.[1] ?? null;
}

function normalizeExactCaskProposedBottleDraft({
  extractedIdentity,
  proposedBottle,
  reference,
}: {
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  reference: BottleReference;
}): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  const brandLooksSmws =
    isSmwsIdentityAnchor(proposedBottle.brand.name) ||
    isSmwsIdentityAnchor(extractedIdentity?.brand) ||
    isSmwsIdentityAnchor(extractedIdentity?.bottler);

  if (!brandLooksSmws) {
    return proposedBottle;
  }

  const bareReferenceCode = getBareSmwsCodeReference(reference.name);
  if (bareReferenceCode) {
    return {
      ...proposedBottle,
      name: bareReferenceCode,
      edition: null,
    };
  }

  const draftCode = proposedBottle.edition ?? extractedIdentity?.edition;
  if (!draftCode || textsOverlap(proposedBottle.name, draftCode)) {
    return proposedBottle;
  }

  return {
    ...proposedBottle,
    name: `${draftCode} ${proposedBottle.name}`.trim(),
    edition: null,
  };
}

function getComparableDomain(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getComparableNameTokens(value: string | null | undefined): string[] {
  return normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0 && !GENERIC_NAME_TOKENS.has(token));
}

function getStrictComparableNameTokens(
  value: string | null | undefined,
): string[] {
  return normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0);
}

function getReferenceAnchoredCreateTokens({
  proposedBottle,
  proposedRelease,
}: {
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  proposedRelease: null | ProposedRelease;
}): string[] {
  return Array.from(
    new Set([
      ...getStrictComparableNameTokens(proposedBottle.brand.name),
      ...getStrictComparableNameTokens(proposedBottle.series?.name),
      ...getStrictComparableNameTokens(proposedBottle.name),
      ...getStrictComparableNameTokens(proposedRelease?.edition),
      ...getStrictComparableNameTokens(
        proposedRelease?.releaseYear != null
          ? String(proposedRelease.releaseYear)
          : null,
      ),
    ]),
  );
}

function tokenSetsMatchExactly(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) {
    return false;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const token of leftSet) {
    if (!rightSet.has(token)) {
      return false;
    }
  }

  return true;
}

function canSkipStandaloneArticleToken(
  tokens: string[],
  index: number,
): boolean {
  if (!STANDALONE_ARTICLE_TOKENS.has(tokens[index] ?? "")) {
    return false;
  }

  if (index >= tokens.length - 1) {
    return false;
  }

  if (index > 0 && STANDALONE_ARTICLE_BLOCKERS.has(tokens[index - 1] ?? "")) {
    return false;
  }

  return true;
}

function tokenSequencesMatchAllowingStandaloneArticle(
  left: string[],
  right: string[],
): boolean {
  if (tokenSetsMatchExactly(left, right)) {
    return true;
  }

  let leftIndex = 0;
  let rightIndex = 0;
  let skippedStandaloneArticle = false;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      !skippedStandaloneArticle &&
      canSkipStandaloneArticleToken(left, leftIndex) &&
      left[leftIndex + 1] === right[rightIndex]
    ) {
      skippedStandaloneArticle = true;
      leftIndex += 1;
      continue;
    }

    if (
      !skippedStandaloneArticle &&
      canSkipStandaloneArticleToken(right, rightIndex) &&
      right[rightIndex + 1] === left[leftIndex]
    ) {
      skippedStandaloneArticle = true;
      rightIndex += 1;
      continue;
    }

    return false;
  }

  return leftIndex === left.length && rightIndex === right.length;
}

function isBasicallyExactNameMatch(
  referenceName: string,
  candidateName: string | null | undefined,
): boolean {
  return tokenSequencesMatchAllowingStandaloneArticle(
    getComparableNameTokens(referenceName),
    getComparableNameTokens(candidateName),
  );
}

function isStrictlyExactNameMatch(
  referenceName: string,
  candidateName: string | null | undefined,
): boolean {
  return tokenSequencesMatchAllowingStandaloneArticle(
    getStrictComparableNameTokens(referenceName),
    getStrictComparableNameTokens(candidateName),
  );
}

function isConservativelySupportedExistingMatchName(
  referenceName: string,
  candidateName: string | null | undefined,
): boolean {
  if (isBasicallyExactNameMatch(referenceName, candidateName)) {
    return true;
  }

  if (!candidateName) {
    return false;
  }

  const strippedCandidateName = stripSafeStrengthPhrases(candidateName);
  if (strippedCandidateName === normalizeComparableText(candidateName).trim()) {
    return false;
  }

  return isStrictlyExactNameMatch(referenceName, strippedCandidateName);
}

function hasReferenceAnchoredSparseCreateProposal({
  reference,
  extractedIdentity,
  candidates,
  proposedBottle,
  proposedRelease,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  candidates: BottleCandidate[];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  proposedRelease: null | ProposedRelease;
}): boolean {
  if (extractedIdentity || candidates.length > 0) {
    return true;
  }

  const referenceTokens = new Set(
    getStrictComparableNameTokens(reference.name),
  );
  if (!referenceTokens.size) {
    return false;
  }

  const brandTokens = getStrictComparableNameTokens(proposedBottle.brand.name);
  const seriesTokens = getStrictComparableNameTokens(
    proposedBottle.series?.name,
  );
  const nameTokens = getStrictComparableNameTokens(proposedBottle.name);
  const proposedTokens = getReferenceAnchoredCreateTokens({
    proposedBottle,
    proposedRelease,
  });
  const introducedTokens = proposedTokens.filter(
    (token) => !referenceTokens.has(token),
  );
  const hasAnchoredBrand =
    brandTokens.length === 0 ||
    brandTokens.every((token) => referenceTokens.has(token));
  const hasAnchoredSeries =
    seriesTokens.length === 0 ||
    seriesTokens.some((token) => referenceTokens.has(token));
  const hasAnchoredName = nameTokens.some((token) =>
    referenceTokens.has(token),
  );

  return (
    hasAnchoredBrand &&
    hasAnchoredSeries &&
    hasAnchoredName &&
    introducedTokens.length <= 2
  );
}

function stripComparablePhrase(
  haystack: string,
  needle: string | null | undefined,
): string {
  const comparableNeedle = normalizeComparableText(needle);
  if (!haystack || !comparableNeedle) {
    return haystack;
  }

  return haystack.replace(
    new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(comparableNeedle)}($|[^a-z0-9])`,
      "g",
    ),
    "$1 $2",
  );
}

const SAFE_STRENGTH_NAME_PHRASES = [
  "barrel proof",
  "barrel strength",
  "cask strength",
  "full proof",
  "natural strength",
] as const;

function stripSafeStrengthPhrases(value: string): string {
  return SAFE_STRENGTH_NAME_PHRASES.reduce(
    (current, phrase) => stripComparablePhrase(current, phrase),
    normalizeComparableText(value),
  );
}

function stripExtractedReleaseIdentityFromReferenceName(
  referenceName: string,
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): string {
  let comparableName = normalizeComparableText(referenceName);

  comparableName = stripComparablePhrase(
    comparableName,
    extractedIdentity?.edition ?? null,
  );

  if (extractedIdentity?.release_year) {
    comparableName = stripComparablePhrase(
      comparableName,
      `${extractedIdentity.release_year} release`,
    );
  }

  if (extractedIdentity?.vintage_year) {
    comparableName = stripComparablePhrase(
      comparableName,
      `${extractedIdentity.vintage_year} vintage`,
    );
  }

  return comparableName.replace(/\s+/g, " ").trim();
}

function buildReferenceNameTokenVariants({
  referenceName,
  extractedIdentity,
}: {
  referenceName: string;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): string[][] {
  const variants: string[][] = [];
  const referenceTokens = getComparableNameTokens(referenceName);
  if (referenceTokens.length) {
    variants.push(referenceTokens);
  }

  const strippedReferenceName = stripExtractedReleaseIdentityFromReferenceName(
    referenceName,
    extractedIdentity,
  );
  const strippedReferenceTokens = getComparableNameTokens(
    strippedReferenceName,
  );
  if (
    strippedReferenceTokens.length &&
    !variants.some((tokens) =>
      tokenSetsMatchExactly(tokens, strippedReferenceTokens),
    )
  ) {
    variants.push(strippedReferenceTokens);
  }

  return variants;
}

function candidateNameMatchesReferenceVariants({
  referenceName,
  extractedIdentity,
  candidateNames,
}: {
  referenceName: string;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  candidateNames: string[];
}): boolean {
  const referenceTokenVariants = buildReferenceNameTokenVariants({
    referenceName,
    extractedIdentity,
  });
  if (!referenceTokenVariants.length) {
    return false;
  }

  return candidateNames.some((candidateName) => {
    const candidateTokenVariants = [
      getComparableNameTokens(candidateName),
      getComparableNameTokens(
        stripSafeStrengthPhrases(normalizeComparableText(candidateName)),
      ),
    ].filter((tokens, index, variants) => {
      if (!tokens.length) {
        return false;
      }

      return !variants
        .slice(0, index)
        .some((existing) => tokenSetsMatchExactly(existing, tokens));
    });

    return candidateTokenVariants.some((candidateTokens) =>
      referenceTokenVariants.some((referenceTokens) =>
        tokenSetsMatchExactly(referenceTokens, candidateTokens),
      ),
    );
  });
}

function textHasLegacyReleaseLikeNameSignals(
  value: string | null | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return LEGACY_RELEASE_LIKE_NAME_PATTERNS.some((pattern) =>
    pattern.test(value),
  );
}

function candidateLooksLikeLegacyReleaseBottle(
  candidate: BottleCandidate | null | undefined,
): boolean {
  if (
    !candidate ||
    candidate.kind === "release" ||
    candidate.releaseId !== null
  ) {
    return false;
  }

  return Boolean(
    candidate.edition ||
    candidate.releaseYear ||
    candidate.vintageYear ||
    textHasLegacyReleaseLikeNameSignals(candidate.alias) ||
    textHasLegacyReleaseLikeNameSignals(candidate.fullName) ||
    textHasLegacyReleaseLikeNameSignals(candidate.bottleFullName),
  );
}

function getSearchEvidenceText(
  evidence: BottleClassificationArtifacts["searchEvidence"][number],
  result: BottleClassificationArtifacts["searchEvidence"][number]["results"][number],
): string {
  return [
    evidence.summary,
    result.title,
    result.description,
    ...result.extraSnippets,
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeObservation(
  observation: BottleObservation | null | undefined,
): BottleObservation | null {
  if (!observation) {
    return null;
  }

  const normalized: BottleObservation = {
    selector: observation.selector?.trim() || null,
    caskNumber: observation.caskNumber?.trim() || null,
    barrelNumber: observation.barrelNumber?.trim() || null,
    bottleNumber: observation.bottleNumber?.trim() || null,
    outturn: observation.outturn ?? null,
    market: observation.market?.trim() || null,
    exclusive: observation.exclusive?.trim() || null,
  };

  return Object.values(normalized).some((value) => value !== null)
    ? normalized
    : null;
}

function hasSingularCaskObservationValue(
  value: string | null | undefined,
): boolean {
  const normalizedValue = normalizeComparableText(value);
  if (!normalizedValue) {
    return false;
  }

  if (
    /\bcasks\b|\bbarrels\b/.test(normalizedValue) ||
    /,|\/|&/.test(normalizedValue) ||
    /\band\b/.test(normalizedValue)
  ) {
    return false;
  }

  const numericMatches = normalizedValue.match(/\d+/g) ?? [];
  return numericMatches.length <= 1;
}

function isKnownExactCaskProgramBrand(value: string | null | undefined) {
  return EXACT_CASK_PROGRAM_BRANDS.has(normalizeComparableText(value));
}

function textHasExactCaskSignalsForScope(
  value: string | null | undefined,
  {
    allowBareNumericCodes,
    abvValues,
  }: {
    allowBareNumericCodes: boolean;
    abvValues: number[];
  },
): boolean {
  if (!value) {
    return false;
  }

  if (EXACT_CASK_ALPHA_NUMERIC_CODE_PATTERN.test(value)) {
    return true;
  }

  if (EXACT_CASK_NUMBER_PATTERNS.some((pattern) => pattern.test(value))) {
    return true;
  }

  if (!allowBareNumericCodes) {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  const matches = normalizedValue.matchAll(EXACT_CASK_NUMERIC_CODE_PATTERN);

  return Array.from(matches).some((match) => {
    const matchedValue = match[0];
    const matchIndex = match.index ?? 0;
    const trailingContext = normalizedValue.slice(
      matchIndex + matchedValue.length,
      matchIndex + matchedValue.length + 12,
    );
    const parsedValue = Number(matchedValue);
    if (Number.isNaN(parsedValue)) {
      return false;
    }

    if (/^\s*(?:%|abv\b|proof\b)/.test(trailingContext)) {
      return false;
    }

    if (
      abvValues.some((abvValue) => Math.abs(abvValue - parsedValue) <= 0.05)
    ) {
      return false;
    }

    return true;
  });
}

function hasExactCaskSignals({
  reference,
  target,
  proposedBottle,
  extractedIdentity,
  observation,
}: {
  reference: BottleReference;
  target?: BottleCandidate | null;
  proposedBottle?: BottleClassificationDecision["proposedBottle"];
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  observation: BottleObservation | null;
}): boolean {
  const hasKnownProgramBrand = [
    proposedBottle?.brand.name,
    extractedIdentity?.brand,
    target?.brand,
  ].some((brand) => isKnownExactCaskProgramBrand(brand));
  const comparableAbvValues = [
    proposedBottle?.abv,
    extractedIdentity?.abv,
    target?.abv,
  ].filter((value): value is number => value !== null && value !== undefined);
  const hasSpecificCaskReference = Boolean(
    hasSingularCaskObservationValue(observation?.caskNumber) ||
    hasSingularCaskObservationValue(observation?.barrelNumber),
  );
  const hasSingleCaskTrait =
    proposedBottle?.singleCask === true ||
    target?.singleCask === true ||
    extractedIdentity?.single_cask === true;
  const hasCodeOrNumberSignal = [
    reference.name,
    extractedIdentity?.expression,
    proposedBottle?.name,
    target?.fullName,
    target?.bottleFullName,
    target?.alias,
  ].some((value) =>
    textHasExactCaskSignalsForScope(value, {
      allowBareNumericCodes: hasKnownProgramBrand,
      abvValues: comparableAbvValues,
    }),
  );

  if (hasKnownProgramBrand && (hasSingleCaskTrait || hasCodeOrNumberSignal)) {
    return true;
  }

  return hasSpecificCaskReference || hasCodeOrNumberSignal;
}

function inferIdentityScope({
  requestedIdentityScope,
  reference,
  target,
  proposedBottle,
  extractedIdentity,
  hasReleaseIdentity,
  observation,
}: {
  requestedIdentityScope: BottleClassifierAgentDecision["identityScope"] | null;
  reference: BottleReference;
  target?: BottleCandidate | null;
  proposedBottle?: BottleClassificationDecision["proposedBottle"];
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  hasReleaseIdentity: boolean;
  observation: BottleObservation | null;
}): BottleClassificationDecision["identityScope"] {
  if (hasReleaseIdentity) {
    return "product";
  }

  if (
    hasExactCaskSignals({
      reference,
      target,
      proposedBottle,
      extractedIdentity,
      observation,
    })
  ) {
    return "exact_cask";
  }

  if (requestedIdentityScope === "exact_cask") {
    return "product";
  }

  return "product";
}

function mergeReleaseIdentityIntoBottleDraft({
  proposedBottle,
  proposedRelease,
}: {
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  proposedRelease: NonNullable<BottleClassificationDecision["proposedRelease"]>;
}): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  return {
    ...proposedBottle,
    edition: proposedBottle.edition ?? proposedRelease.edition,
    statedAge: proposedBottle.statedAge ?? proposedRelease.statedAge,
    abv: proposedBottle.abv ?? proposedRelease.abv,
    caskStrength: proposedBottle.caskStrength ?? proposedRelease.caskStrength,
    singleCask: proposedBottle.singleCask ?? proposedRelease.singleCask,
    vintageYear: proposedBottle.vintageYear ?? proposedRelease.vintageYear,
    releaseYear: proposedBottle.releaseYear ?? proposedRelease.releaseYear,
    caskType: proposedBottle.caskType ?? proposedRelease.caskType,
    caskSize: proposedBottle.caskSize ?? proposedRelease.caskSize,
    caskFill: proposedBottle.caskFill ?? proposedRelease.caskFill,
  };
}

function getMatchedTarget(
  decision: BottleClassificationDecision,
  candidates: BottleCandidate[],
): BottleCandidate | null {
  if (decision.action !== "match") {
    return null;
  }

  return (
    candidates.find(
      (candidate) =>
        candidate.bottleId === decision.matchedBottleId &&
        (decision.matchedReleaseId != null
          ? candidate.releaseId === decision.matchedReleaseId
          : candidate.releaseId === null || candidate.kind === "bottle"),
    ) ?? null
  );
}

function getTargetNameCandidates(
  target: BottleCandidate,
  decision: BottleClassificationDecision,
): string[] {
  const names =
    decision.action === "match" &&
    (decision.matchedReleaseId != null || target.kind === "release")
      ? [target.alias, target.fullName]
      : [
          target.alias,
          target.bottleFullName ?? target.fullName,
          target.fullName,
        ];

  return Array.from(new Set(names.filter(Boolean))) as string[];
}

function getBottleTargetNameCandidates(target: BottleCandidate): string[] {
  return Array.from(
    new Set(
      [target.alias, target.bottleFullName ?? target.fullName, target.fullName]
        .filter(Boolean)
        .map((value) => value!.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function resolvePromotableParentBottleTarget({
  reference,
  target,
  artifacts,
}: {
  reference: BottleReference;
  target: BottleCandidate | null;
  artifacts: BottleClassificationArtifacts;
}): BottleCandidate | null {
  if (!target || target.kind === "release" || target.releaseId !== null) {
    return null;
  }

  if (!candidateLooksLikeLegacyReleaseBottle(target)) {
    return target;
  }

  const reusableParentCandidates = artifacts.candidates
    .filter(
      (candidate) =>
        candidate.bottleId !== target.bottleId &&
        candidate.releaseId === null &&
        candidate.kind !== "release" &&
        !candidateLooksLikeLegacyReleaseBottle(candidate),
    )
    .filter(
      (candidate) =>
        getExistingMatchIdentityConflicts({
          referenceName: reference.name,
          targetCandidate: candidate,
          extractedLabel: artifacts.extractedIdentity,
        }).length === 0,
    )
    .filter((candidate) =>
      candidateNameMatchesReferenceVariants({
        referenceName: reference.name,
        extractedIdentity: artifacts.extractedIdentity,
        candidateNames: getBottleTargetNameCandidates(candidate),
      }),
    )
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

  return reusableParentCandidates[0] ?? null;
}

function hasSupportiveWebEvidenceForTarget({
  target,
  decision,
  reference,
  artifacts,
}: {
  target: BottleCandidate;
  decision: BottleClassificationDecision;
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  if (
    reference.url &&
    hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: reference.url,
      targetCandidate: target,
      extractedLabel: artifacts.extractedIdentity,
      searchEvidence: artifacts.searchEvidence,
    })
  ) {
    return true;
  }

  const referenceDomain = getComparableDomain(reference.url ?? null);
  const targetTokenSets = getTargetNameCandidates(target, decision)
    .map((name) => getComparableNameTokens(name))
    .filter((tokens) => tokens.length > 0);

  if (!targetTokenSets.length) {
    return false;
  }

  for (const evidence of artifacts.searchEvidence) {
    for (const result of evidence.results) {
      const resultDomain = getComparableDomain(result.url);
      if (
        !resultDomain ||
        (referenceDomain !== null &&
          domainMatches(resultDomain, referenceDomain))
      ) {
        continue;
      }

      const resultTokens = new Set(
        getComparableNameTokens(getSearchEvidenceText(evidence, result)),
      );
      if (!resultTokens.size) {
        continue;
      }

      if (
        targetTokenSets.some((tokens) =>
          tokens.every((token) => resultTokens.has(token)),
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function createNoMatchDecision({
  decision,
  candidateBottleIds,
  rationale,
  observation,
  identityScope,
}: {
  decision: Pick<
    BottleClassifierAgentDecision,
    "confidence" | "rationale" | "identityScope"
  >;
  candidateBottleIds: number[];
  rationale: string | null;
  observation: BottleObservation | null;
  identityScope?: BottleClassificationDecision["identityScope"];
}): BottleClassificationDecision {
  return {
    action: "no_match",
    confidence: decision.confidence,
    rationale,
    candidateBottleIds,
    identityScope: identityScope ?? decision.identityScope ?? "product",
    observation,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle: null,
    proposedRelease: null,
  };
}

function hasMeaningfulReleaseDraft(
  proposedRelease: ProposedRelease | null | undefined,
): proposedRelease is ProposedRelease {
  if (!proposedRelease) {
    return false;
  }

  return [
    proposedRelease.edition,
    proposedRelease.statedAge,
    proposedRelease.abv,
    proposedRelease.caskStrength,
    proposedRelease.singleCask,
    proposedRelease.vintageYear,
    proposedRelease.releaseYear,
    proposedRelease.caskType,
    proposedRelease.caskSize,
    proposedRelease.caskFill,
  ].some((value) => value !== null && value !== undefined);
}

function buildReleaseDraftFromExtractedIdentity({
  extractedIdentity,
  target,
}: {
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  target: BottleCandidate;
}): ProposedRelease | null {
  if (!extractedIdentity) {
    return null;
  }

  const normalizedDrafts = normalizeBottleCreationDrafts({
    creationTarget: "release",
    proposedRelease: {
      edition:
        extractedIdentity.edition &&
        !textsOverlap(extractedIdentity.edition, target.edition)
          ? extractedIdentity.edition
          : null,
      statedAge:
        extractedIdentity.stated_age !== null &&
        extractedIdentity.stated_age !== target.statedAge &&
        (target.statedAge === null ||
          target.statedAge === undefined ||
          hasDirtyParentStatedAgeConflict({
            targetCandidate: target,
            extractedLabel: extractedIdentity,
          }))
          ? extractedIdentity.stated_age
          : null,
      abv: null,
      caskStrength: null,
      singleCask: null,
      vintageYear:
        extractedIdentity.vintage_year !== null &&
        extractedIdentity.vintage_year !== target.vintageYear
          ? extractedIdentity.vintage_year
          : null,
      releaseYear:
        extractedIdentity.release_year !== null &&
        extractedIdentity.release_year !== target.releaseYear
          ? extractedIdentity.release_year
          : null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      description: null,
      tastingNotes: null,
      imageUrl: null,
    },
  });

  return hasMeaningfulReleaseDraft(normalizedDrafts.proposedRelease)
    ? normalizedDrafts.proposedRelease
    : null;
}

function maybePromoteBottleMatchToCreateRelease({
  reference,
  decision,
  target,
  artifacts,
  candidateBottleIds,
  observation,
}: {
  reference: BottleReference;
  decision: Pick<
    BottleClassificationDecision,
    "confidence" | "rationale" | "identityScope"
  >;
  target: BottleCandidate | null;
  artifacts: BottleClassificationArtifacts;
  candidateBottleIds: number[];
  observation: BottleObservation | null;
}): BottleClassificationDecision | null {
  const parentTarget = resolvePromotableParentBottleTarget({
    reference,
    target,
    artifacts,
  });

  if (
    !parentTarget ||
    decision.identityScope === "exact_cask" ||
    artifacts.candidates.some(
      (candidate) =>
        candidate.bottleId === parentTarget.bottleId &&
        candidate.releaseId !== null,
    )
  ) {
    return null;
  }

  const proposedRelease = buildReleaseDraftFromExtractedIdentity({
    extractedIdentity: artifacts.extractedIdentity,
    target: parentTarget,
  });

  if (!proposedRelease) {
    return null;
  }

  const identityConflicts = getExistingMatchIdentityConflicts({
    referenceName: reference.name,
    targetCandidate: parentTarget,
    extractedLabel: artifacts.extractedIdentity,
  });
  const hasExactishLocalName = candidateNameMatchesReferenceVariants({
    referenceName: reference.name,
    extractedIdentity: artifacts.extractedIdentity,
    candidateNames: getTargetNameCandidates(parentTarget, {
      action: "match",
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds,
      identityScope: decision.identityScope ?? "product",
      observation,
      matchedBottleId: parentTarget.bottleId,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    }),
  });
  const hasSupportiveWebEvidence = hasSupportiveWebEvidenceForTarget({
    target: parentTarget,
    decision: {
      action: "match",
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds,
      identityScope: decision.identityScope ?? "product",
      observation,
      matchedBottleId: parentTarget.bottleId,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    },
    reference,
    artifacts,
  });

  if (
    !parentTarget.source.includes("exact") &&
    (identityConflicts.length > 0 ||
      (!hasExactishLocalName && !hasSupportiveWebEvidence))
  ) {
    return null;
  }

  const promotionRationale = appendRationale(
    decision.rationale,
    "Server promoted the bottle match to release creation because the extracted identity carries release-level detail beyond the matched parent bottle.",
  );

  return {
    action: "create_release",
    confidence: decision.confidence,
    rationale:
      target && parentTarget.bottleId !== target.bottleId
        ? appendRationale(
            promotionRationale,
            "Server redirected release creation away from a legacy release-like bottle candidate to a reusable parent bottle.",
          )
        : promotionRationale,
    candidateBottleIds,
    identityScope: "product",
    observation,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: parentTarget.bottleId,
    proposedBottle: null,
    proposedRelease,
  };
}

function findReusableParentBottleTargetForCreateRelease({
  reference,
  artifacts,
  proposedBottle,
}: {
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
}): BottleCandidate | null {
  return (
    artifacts.candidates
      .filter(
        (candidate) =>
          candidate.releaseId === null &&
          candidate.kind !== "release" &&
          !candidateLooksLikeLegacyReleaseBottle(candidate),
      )
      .filter(
        (candidate) =>
          candidateNameMatchesReferenceVariants({
            referenceName: reference.name,
            extractedIdentity: artifacts.extractedIdentity,
            candidateNames: getBottleTargetNameCandidates(candidate),
          }) ||
          getBottleTargetNameCandidates(candidate).some(
            (candidateName) =>
              textsOverlap(
                candidateName,
                `${proposedBottle.brand.name} ${proposedBottle.name}`,
              ) ||
              textsOverlap(candidateName, proposedBottle.name) ||
              textsOverlap(candidateName, proposedBottle.series?.name),
          ),
      )
      .filter((candidate) => {
        if (candidate.source.includes("exact")) {
          return true;
        }

        return (
          getExistingMatchIdentityConflicts({
            referenceName: reference.name,
            targetCandidate: candidate,
            extractedLabel: artifacts.extractedIdentity,
          }).length === 0
        );
      })
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ?? null
  );
}

function downgradeUnsafeExistingMatchDecision({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  if (decision.action !== "match") {
    return decision;
  }

  const target = getMatchedTarget(decision, artifacts.candidates);
  if (!target || target.source.includes("exact")) {
    return decision;
  }

  const hasExactishLocalName = getTargetNameCandidates(target, decision).some(
    (name) => isConservativelySupportedExistingMatchName(reference.name, name),
  );
  const hasSupportiveWebEvidence = hasSupportiveWebEvidenceForTarget({
    target,
    decision,
    reference,
    artifacts,
  });
  const identityConflicts = getExistingMatchIdentityConflicts({
    referenceName: reference.name,
    targetCandidate: target,
    extractedLabel: artifacts.extractedIdentity,
  });

  if (
    !identityConflicts.length &&
    (hasExactishLocalName || hasSupportiveWebEvidence)
  ) {
    return decision;
  }

  const reasons: string[] = [];
  if (identityConflicts.length) {
    reasons.push(
      `the candidate conflicts with extracted reference details (${identityConflicts.join(
        "; ",
      )})`,
    );
  }
  if (!hasExactishLocalName && !hasSupportiveWebEvidence) {
    reasons.push(
      "there is no exact alias, no exactish canonical name match, and no supportive off-retailer web evidence for the matched target",
    );
  }

  return createNoMatchDecision({
    decision,
    candidateBottleIds: decision.candidateBottleIds,
    observation: decision.observation,
    identityScope: decision.identityScope,
    rationale: appendRationale(
      decision.rationale,
      `Server downgraded the existing-match recommendation because ${reasons.join(
        " and ",
      )}.`,
    ),
  });
}

function sanitizeResolvedEntityChoice(
  choice: {
    id: number | null;
    name: string;
  },
  expectedType: "brand" | "distiller" | "bottler",
  resolvedEntities: Map<number, EntityResolution>,
): {
  id: number | null;
  name: string;
} {
  if (choice.id === null) {
    return choice;
  }

  const resolvedEntity = resolvedEntities.get(choice.id);
  if (!resolvedEntity || !resolvedEntity.type.includes(expectedType)) {
    return {
      ...choice,
      id: null,
    };
  }

  const normalizedChoiceName = normalizeEntityChoiceName(choice.name);
  const matchedNames = [
    resolvedEntity.name,
    resolvedEntity.shortName,
    resolvedEntity.alias,
  ]
    .filter((name): name is string => Boolean(name))
    .map(normalizeEntityChoiceName);

  if (!matchedNames.includes(normalizedChoiceName)) {
    return {
      ...choice,
      id: null,
    };
  }

  return {
    id: resolvedEntity.entityId,
    name: resolvedEntity.name,
  };
}

function sanitizeProposedBottleDraft(
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>,
  resolvedEntitiesById: Map<number, EntityResolution>,
): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  return {
    ...proposedBottle,
    category:
      proposedBottle.category === "spirit" ? null : proposedBottle.category,
    series: proposedBottle.series
      ? {
          ...proposedBottle.series,
          id: null,
        }
      : null,
    brand: sanitizeResolvedEntityChoice(
      proposedBottle.brand,
      "brand",
      resolvedEntitiesById,
    ),
    distillers: proposedBottle.distillers.map((distiller) =>
      sanitizeResolvedEntityChoice(
        distiller,
        "distiller",
        resolvedEntitiesById,
      ),
    ),
    bottler: proposedBottle.bottler
      ? sanitizeResolvedEntityChoice(
          proposedBottle.bottler,
          "bottler",
          resolvedEntitiesById,
        )
      : null,
  };
}

function sanitizeClassifierDecision({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  const candidateBottleIds = new Set(
    artifacts.candidates.map((candidate) => candidate.bottleId),
  );
  const candidateReleaseIds = new Set(
    artifacts.candidates
      .map((candidate) => candidate.releaseId)
      .filter((releaseId): releaseId is number => releaseId !== null),
  );
  const resolvedEntitiesById = new Map(
    artifacts.resolvedEntities.map((entity) => [entity.entityId, entity]),
  );
  const normalizedConfidence = normalizeClassifierConfidence(
    decision.confidence,
  );
  const filteredCandidateBottleIds = decision.candidateBottleIds.filter((id) =>
    candidateBottleIds.has(id),
  );
  const observation = normalizeObservation(decision.observation);

  if (decision.action === "match") {
    if (decision.matchedBottleId === null) {
      return createNoMatchDecision({
        decision: {
          confidence: normalizedConfidence,
          rationale: decision.rationale,
          identityScope: decision.identityScope,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded match because no matched bottle id was returned.",
        ),
      });
    }

    const matchedBottleId = decision.matchedBottleId;
    const matchedReleaseId = decision.matchedReleaseId ?? null;

    if (!candidateBottleIds.has(matchedBottleId)) {
      throw new BottleClassificationError(
        `Classifier returned unknown matched bottle id (${matchedBottleId}).`,
        artifacts,
      );
    }

    if (
      matchedReleaseId != null &&
      !candidateReleaseIds.has(matchedReleaseId)
    ) {
      throw new BottleClassificationError(
        `Classifier returned unknown matched release id (${matchedReleaseId}).`,
        artifacts,
      );
    }

    const target =
      artifacts.candidates.find(
        (candidate) =>
          candidate.bottleId === matchedBottleId &&
          (matchedReleaseId != null
            ? candidate.releaseId === matchedReleaseId
            : candidate.releaseId === null || candidate.kind === "bottle"),
      ) ?? null;

    const promotedCreateRelease = maybePromoteBottleMatchToCreateRelease({
      reference,
      decision: {
        confidence: normalizedConfidence,
        rationale: decision.rationale,
        identityScope: decision.identityScope ?? "product",
      },
      target,
      artifacts,
      candidateBottleIds: filteredCandidateBottleIds,
      observation,
    });
    if (promotedCreateRelease) {
      return promotedCreateRelease;
    }

    return {
      action: "match",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: null,
        hasReleaseIdentity: matchedReleaseId != null,
        observation,
      }),
      observation,
      matchedBottleId,
      matchedReleaseId,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    };
  }

  if (decision.action === "create_bottle") {
    if (!decision.proposedBottle) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_bottle because no proposed bottle draft was returned.",
        ),
      });
    }

    const sanitizedBottleDraft = normalizeExactCaskProposedBottleDraft({
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: sanitizeProposedBottleDraft(
        decision.proposedBottle,
        resolvedEntitiesById,
      ),
      reference,
    });
    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: "bottle",
      proposedBottle: sanitizedBottleDraft,
      proposedRelease: null,
    });

    if (!normalizedDrafts.proposedBottle) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_bottle because the proposed bottle draft could not be normalized.",
        ),
      });
    }

    if (
      !hasReferenceAnchoredSparseCreateProposal({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        candidates: artifacts.candidates,
        proposedBottle: normalizedDrafts.proposedBottle,
        proposedRelease: null,
      })
    ) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_bottle because the proposed bottle identity expanded too far beyond a sparse unanchored reference.",
        ),
      });
    }

    return {
      action: "create_bottle",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: normalizedDrafts.proposedBottle,
        hasReleaseIdentity: false,
        observation,
      }),
      observation,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: normalizedDrafts.proposedBottle,
      proposedRelease: null,
    };
  }

  if (decision.action === "create_release") {
    if (decision.parentBottleId === null) {
      return createNoMatchDecision({
        decision: {
          confidence: normalizedConfidence,
          rationale: decision.rationale,
          identityScope: decision.identityScope,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_release because no parent bottle id was returned.",
        ),
      });
    }

    const parentBottleId = decision.parentBottleId;
    if (!candidateBottleIds.has(parentBottleId)) {
      throw new BottleClassificationError(
        `Classifier returned unknown parent bottle id (${parentBottleId}).`,
        artifacts,
      );
    }

    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: "release",
      proposedBottle: null,
      proposedRelease: decision.proposedRelease ?? null,
    });

    if (!normalizedDrafts.proposedRelease) {
      return {
        action: "match",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded release creation to a bottle match because no reusable release identity remained after normalization.",
        ),
        candidateBottleIds: filteredCandidateBottleIds,
        identityScope: "product",
        observation,
        matchedBottleId: parentBottleId,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      };
    }

    return {
      action: "create_release",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: "product",
      observation,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId,
      proposedBottle: null,
      proposedRelease: normalizedDrafts.proposedRelease,
    };
  }

  if (decision.action === "create_bottle_and_release") {
    if (!decision.proposedBottle) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle-and-release creation because no proposed bottle draft was returned.",
        ),
      });
    }

    const sanitizedBottleDraft = normalizeExactCaskProposedBottleDraft({
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: sanitizeProposedBottleDraft(
        decision.proposedBottle,
        resolvedEntitiesById,
      ),
      reference,
    });
    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: "bottle_and_release",
      proposedBottle: sanitizedBottleDraft,
      proposedRelease: decision.proposedRelease ?? null,
    });

    if (!normalizedDrafts.proposedBottle) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle-and-release creation because the proposed bottle draft could not be normalized.",
        ),
      });
    }

    if (!normalizedDrafts.proposedRelease) {
      return {
        action: "create_bottle",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle-and-release creation to bottle creation because no reusable release identity remained after normalization.",
        ),
        candidateBottleIds: filteredCandidateBottleIds,
        identityScope: inferIdentityScope({
          requestedIdentityScope: decision.identityScope,
          reference,
          target: null,
          extractedIdentity: artifacts.extractedIdentity,
          proposedBottle: normalizedDrafts.proposedBottle,
          hasReleaseIdentity: false,
          observation,
        }),
        observation,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: normalizedDrafts.proposedBottle,
        proposedRelease: null,
      };
    }

    if (
      !hasReferenceAnchoredSparseCreateProposal({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        candidates: artifacts.candidates,
        proposedBottle: normalizedDrafts.proposedBottle,
        proposedRelease: normalizedDrafts.proposedRelease,
      })
    ) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle-and-release creation because the proposed bottle or release identity expanded too far beyond a sparse unanchored reference.",
        ),
      });
    }

    const promotedParentTarget = findReusableParentBottleTargetForCreateRelease(
      {
        reference,
        artifacts,
        proposedBottle: normalizedDrafts.proposedBottle,
      },
    );
    const promotedReleaseDraft =
      promotedParentTarget &&
      buildReleaseDraftFromExtractedIdentity({
        extractedIdentity: artifacts.extractedIdentity,
        target: promotedParentTarget,
      });

    if (promotedParentTarget && promotedReleaseDraft) {
      return {
        action: "create_release",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server promoted bottle-and-release creation to release creation because a reusable parent bottle already exists locally.",
        ),
        candidateBottleIds: filteredCandidateBottleIds,
        identityScope: "product",
        observation,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: promotedParentTarget.bottleId,
        proposedBottle: null,
        proposedRelease: promotedReleaseDraft,
      };
    }

    const exactCaskIdentityScope = inferIdentityScope({
      requestedIdentityScope: decision.identityScope,
      reference,
      target: null,
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: normalizedDrafts.proposedBottle,
      hasReleaseIdentity: false,
      observation,
    });

    if (exactCaskIdentityScope === "exact_cask") {
      const exactCaskBottleDraft = normalizeBottleCreationDrafts({
        creationTarget: "bottle",
        proposedBottle: mergeReleaseIdentityIntoBottleDraft({
          proposedBottle: normalizedDrafts.proposedBottle,
          proposedRelease: normalizedDrafts.proposedRelease,
        }),
        proposedRelease: null,
      }).proposedBottle;

      return {
        action: "create_bottle",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle-and-release creation to bottle creation because exact-cask identity cannot create a child release beneath the bottle.",
        ),
        candidateBottleIds: filteredCandidateBottleIds,
        identityScope: "exact_cask",
        observation,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: exactCaskBottleDraft ?? normalizedDrafts.proposedBottle,
        proposedRelease: null,
      };
    }

    return {
      action: "create_bottle_and_release",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: "product",
      observation,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: normalizedDrafts.proposedBottle,
      proposedRelease: normalizedDrafts.proposedRelease,
    };
  }

  return {
    action: "no_match",
    confidence: normalizedConfidence,
    rationale: decision.rationale,
    candidateBottleIds: filteredCandidateBottleIds,
    identityScope: inferIdentityScope({
      requestedIdentityScope: decision.identityScope,
      reference,
      target: null,
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: null,
      hasReleaseIdentity: false,
      observation,
    }),
    observation,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle: null,
    proposedRelease: null,
  };
}

export function shouldAutoIgnoreBottleReference(
  referenceName: string,
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): boolean {
  return (
    getAutoIgnoreBottleReferenceReason(referenceName, extractedIdentity) !==
    null
  );
}

export function getAutoIgnoreBottleReferenceReason(
  referenceName: string,
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): string | null {
  if (extractedIdentity) {
    return null;
  }

  const normalizedName = normalizeString(referenceName).toLowerCase();
  if (
    NON_WHISKY_KEYWORDS.test(normalizedName) &&
    !WHISKY_KEYWORDS.test(normalizedName)
  ) {
    return "Reference is clearly a non-whisky category match and extraction found no whisky identity.";
  }

  if (GIFT_SET_PACKAGING_KEYWORDS.test(normalizedName)) {
    const identityTokens = getComparableNameTokens(normalizedName).filter(
      (token) => !GIFT_SET_PACKAGING_TOKENS.has(token) && !/^\d+$/.test(token),
    );
    if (identityTokens.length === 0) {
      return "Reference is packaging-only gift-set text and extraction found no whisky identity.";
    }
  }

  return null;
}

export function finalizeBottleReferenceClassification({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  const sanitizedDecision = sanitizeClassifierDecision({
    reference,
    decision,
    artifacts,
  });
  return BottleClassificationDecisionSchema.parse(
    downgradeUnsafeExistingMatchDecision({
      reference,
      decision: sanitizedDecision,
      artifacts,
    }),
  );
}
