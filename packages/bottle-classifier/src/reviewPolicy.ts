import { normalizePotentialProofLikeDecision } from "./abv";
import {
  extractedIdentityLooksLikePlainAgeStatementReference,
  getExistingMatchIdentityConflicts,
} from "./bottleClassificationEvidence";
import { normalizeBottleCreationDrafts } from "./bottleCreationDrafts";
import {
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
  type BottleCandidate,
  type BottleClassificationDecision,
  type BottleClassifierAgentDecision,
  type BottleClassifierAgentDecisionInput,
  type BottleObservation,
  type EntityResolution,
  type ProposedBottle,
  type ProposedRelease,
} from "./classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "./contract";
import { BottleClassificationError } from "./error";
import {
  candidateHasExactCaskCodeAnchor,
  getExactCaskCodeAnchor,
} from "./exactCask";
import {
  hasExactCaskSignals,
  inferBottleIdentityScope,
} from "./exactCaskPolicy";
import {
  normalizeBottle,
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "./normalize";
import { normalizeObservation } from "./observation";
import { isExistingMatchConfidenceEligibleForVerification } from "./priceMatchingEvidence";
import {
  getSmwsCodeAnchor,
  maybeResolveSmwsExactCaskCodeDecision,
  normalizeSmwsExactCaskProposedBottleDraft,
} from "./smwsPolicy";

// These deterministic patterns are only reject/scope guards. They must not grow
// into whisky taxonomy inference or semantic action promotion: new phrase rules
// require verified whisky research and focused tests, and ambiguous styles belong
// to the web-enabled classifier.
const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const GIFT_SET_PACKAGING_KEYWORDS =
  /\b(gift set|gift pack|gift box|holiday pack|with glass|with glasses|glassware)\b/i;
const MULTI_ITEM_REFERENCE_PATTERNS = [
  GIFT_SET_PACKAGING_KEYWORDS,
  /\bbundle\b/i,
  /\b(?:sampler|tasting|variety)\s+(?:pack|set|bundle)\b/i,
  /\b\d+\s*(?:-|x)?\s*pack\b/i,
  /\b(?:pack|set|case)\s+of\s+\d+\b/i,
  /\b\d+\s*x\s*\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/i,
] as const;
const NON_STANDARD_CONDITION_REFERENCE_PATTERNS = [
  /\bblooper bottle\b/i,
  /\bbroken (?:wax )?seal\b/i,
  /\b(?:opened|open)\s+bottle\b/i,
  /\blow fill\b/i,
  /\bleak(?:ing)?\b/i,
  /\b(?:damaged|missing|cracked|torn|scuffed)\s+(?:box|tube|tin|wax|seal|stopper|label)\b/i,
] as const;
const WHISKY_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;
const GENERIC_NAME_TOKENS = new Set([
  "aged",
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
const LEGACY_RELEASE_LIKE_NAME_PATTERNS = [
  /\bbatch(?:\s*(?:no\.?|number|#))?\s*[a-z0-9.-]+\b/i,
  /\b\d{4}\s+release\b/i,
  /\b\d{4}\s+vintage\b/i,
  /\b\d+(?:st|nd|rd|th)\s+edition\b/i,
  /\b(?:chapter|part|vol(?:ume)?\.?)\s+[a-z0-9ivxlcdm.-]+\b/i,
] as const;
const CREATION_EVIDENCE_GENERIC_TOKENS = new Set([
  "and",
  "bottle",
  "cl",
  "l",
  "ml",
  "of",
  "old",
  "oz",
  "scotch",
  "single",
  "spirit",
  "spirits",
  "the",
  "whiskey",
  "whisky",
  "year",
  "years",
  "yr",
  "yrs",
]);
const AGE_WORD_ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;
const AGE_WORD_TEENS = [
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;
const AGE_WORD_TENS: Record<number, string> = {
  20: "twenty",
  30: "thirty",
  40: "forty",
  50: "fifty",
  60: "sixty",
  70: "seventy",
  80: "eighty",
  90: "ninety",
};
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

function getComparableAgeStatementPattern(statedAge: number): RegExp {
  const age = escapeRegExp(String(statedAge));

  return new RegExp(
    `\\b${age}(?:\\s|-)?(?:year|yr)s?(?:\\s|-)?old\\b|\\b${age}(?:\\s|-)?(?:year|yr)s?\\b|\\b${age}(?:\\s|-)?y(?:\\.?o\\.?)?\\b`,
    "i",
  );
}

function stripComparableAgeStatement(
  value: string,
  statedAge: number | null | undefined,
): string {
  if (statedAge === null || statedAge === undefined) {
    return value;
  }

  return value
    .replace(getComparableAgeStatementPattern(statedAge), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function comparableTextMarketsStatedAge(
  value: string | null | undefined,
  statedAge: number | null | undefined,
): boolean {
  if (!value || statedAge === null || statedAge === undefined) {
    return false;
  }

  return getComparableAgeStatementPattern(statedAge).test(
    normalizeComparableText(value),
  );
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
  return normalizeNameTokenizationText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0 && !GENERIC_NAME_TOKENS.has(token));
}

function getStrictComparableNameTokens(
  value: string | null | undefined,
): string[] {
  return normalizeNameTokenizationText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0);
}

function normalizeNameTokenizationText(
  value: string | null | undefined,
): string {
  return normalizeComparableText(value)
    .replace(/\b([a-z0-9]+)'s\b/g, "$1s")
    .replace(/\b([a-z0-9]+)s'\b/g, "$1s");
}

function hasExplicitPossessiveMarker(
  value: string | null | undefined,
): boolean {
  return /\b[a-z0-9]+'s\b|\b[a-z0-9]+s'\b/i.test(
    normalizeComparableText(value),
  );
}

function getComparableNameTokenVariants(
  value: string | null | undefined,
  strict = false,
): string[][] {
  const rawTokens = normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9']+/g)
    .filter((token) => token.length > 0);

  if (!rawTokens.length) {
    return [];
  }

  let variants: string[][] = [[]];

  for (const rawToken of rawTokens) {
    const tokenVariants = Array.from(
      new Set(
        expandComparableEvidenceToken(rawToken).map((token) =>
          token.replace(/'/g, ""),
        ),
      ),
    ).filter(
      (token) =>
        token.length > 0 && (strict || !GENERIC_NAME_TOKENS.has(token)),
    );

    if (!tokenVariants.length) {
      continue;
    }

    variants = variants.flatMap((sequence) =>
      tokenVariants.map((token) => [...sequence, token]),
    );
  }

  return variants;
}

// Retailer titles often drop possessive punctuation from brand names
// entirely. Treat that as exactish support for reviewed existing matches
// without broadening the literal alias fast path.
function isPossessiveInsensitiveExactNameMatch(
  referenceName: string,
  candidateName: string | null | undefined,
  strict = false,
): boolean {
  if (
    !candidateName ||
    (!hasExplicitPossessiveMarker(referenceName) &&
      !hasExplicitPossessiveMarker(candidateName))
  ) {
    return false;
  }

  const referenceVariants = getComparableNameTokenVariants(
    referenceName,
    strict,
  );
  const candidateVariants = getComparableNameTokenVariants(
    candidateName,
    strict,
  );

  return referenceVariants.some((referenceTokens) =>
    candidateVariants.some((candidateTokens) =>
      tokenSequencesMatchAllowingStandaloneArticle(
        referenceTokens,
        candidateTokens,
      ),
    ),
  );
}

function getComparableEvidenceTokens(
  value: string | null | undefined,
): string[] {
  return normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9']+/g)
    .flatMap(expandComparableEvidenceToken)
    .filter(
      (token) =>
        token.length > 0 && token !== "s" && !GENERIC_NAME_TOKENS.has(token),
    );
}

function expandComparableEvidenceToken(token: string): string[] {
  const singularPossessiveMatch = token.match(/^([a-z0-9]+)'s$/);
  if (singularPossessiveMatch) {
    const base = singularPossessiveMatch[1];
    return [base, `${base}s`];
  }

  const pluralPossessiveMatch = token.match(/^([a-z0-9]+)s'$/);
  if (pluralPossessiveMatch) {
    const base = pluralPossessiveMatch[1];
    return [base, `${base}s`];
  }

  return [token];
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

function isStrictlyExactNameMatch(
  referenceName: string,
  candidateName: string | null | undefined,
): boolean {
  return tokenSequencesMatchAllowingStandaloneArticle(
    getStrictComparableNameTokens(referenceName),
    getStrictComparableNameTokens(candidateName),
  );
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
  allowSafeStrengthPhraseStripping = true,
}: {
  referenceName: string;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  candidateNames: string[];
  allowSafeStrengthPhraseStripping?: boolean;
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
      ...(allowSafeStrengthPhraseStripping
        ? [
            getComparableNameTokens(
              stripSafeStrengthPhrases(normalizeComparableText(candidateName)),
            ),
          ]
        : []),
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

  const normalizedValue = normalizeString(value);
  for (const match of normalizedValue.matchAll(
    /\bbatch(?:\s*(?:no\.?|number|#))?\s*[a-z0-9.-]+\b/gi,
  )) {
    const matchIndex = match.index ?? 0;
    const prefix = normalizedValue.slice(
      Math.max(0, matchIndex - 8),
      matchIndex,
    );
    if (!/\bsmall\s*$/i.test(prefix)) {
      return true;
    }
  }

  return LEGACY_RELEASE_LIKE_NAME_PATTERNS.slice(1).some((pattern) =>
    pattern.test(normalizedValue),
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

function candidateNameMarketsStatedAge(
  candidate: BottleCandidate,
  statedAge: number | null | undefined,
): boolean {
  return getBottleTargetNameCandidates(candidate).some((name) =>
    comparableTextMarketsStatedAge(name, statedAge),
  );
}

function getCandidateFamilyName(
  candidate: BottleCandidate | null | undefined,
): string {
  if (!candidate) {
    return "";
  }

  return (
    candidate.bottleFullName ??
    candidate.fullName ??
    candidate.alias ??
    ""
  ).trim();
}

function candidateMatchesExtractedBrandAndCategory({
  candidate,
  extractedIdentity,
}: {
  candidate: BottleCandidate;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  if (!extractedIdentity?.brand) {
    return false;
  }

  const brandMatches =
    textsOverlap(candidate.brand, extractedIdentity.brand) ||
    Boolean(
      extractedIdentity.bottler &&
      textsOverlap(candidate.bottler, extractedIdentity.bottler),
    );
  if (!brandMatches) {
    return false;
  }

  if (
    extractedIdentity.category &&
    candidate.category &&
    candidate.category !== extractedIdentity.category
  ) {
    return false;
  }

  return true;
}

function candidateMatchesExtractedFamily({
  candidate,
  extractedIdentity,
}: {
  candidate: BottleCandidate;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  if (!extractedIdentity) {
    return false;
  }

  if (
    !candidateMatchesExtractedBrandAndCategory({
      candidate,
      extractedIdentity,
    })
  ) {
    return false;
  }

  if (extractedIdentity.expression) {
    return getBottleTargetNameCandidates(candidate).some((name) =>
      textsOverlap(name, extractedIdentity.expression),
    );
  }

  if (extractedIdentity.series) {
    return (
      textsOverlap(candidate.series, extractedIdentity.series) ||
      getBottleTargetNameCandidates(candidate).some((name) =>
        textsOverlap(name, extractedIdentity.series),
      )
    );
  }

  return false;
}

function candidateHasLocalParentAnchorSource(candidate: BottleCandidate) {
  return (
    candidate.source.includes("exact") ||
    candidate.source.includes("text") ||
    candidate.source.includes("repair_parent")
  );
}

function candidateMatchesLocalParentAnchor({
  candidate,
  extractedIdentity,
}: {
  candidate: BottleCandidate;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}) {
  if (candidate.source.includes("repair_parent")) {
    return candidateMatchesExtractedBrandAndCategory({
      candidate,
      extractedIdentity,
    });
  }

  return candidateMatchesExtractedFamily({
    candidate,
    extractedIdentity,
  });
}

function extractLegacyReleaseEditionFromText(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = normalizeString(value).replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(Batch(?:\s*(?:No\.?|Number|#))?\s*[A-Za-z0-9.-]+)\b/i,
    /\b((?:Chapter|Part|Vol(?:ume)?\.?)\s+[A-Za-z0-9IVXLCM.-]+)\b/i,
    /\b(\d+(?:st|nd|rd|th)\s+Edition)\b/i,
    /\b(\d{4}\s+Release)\b/i,
  ] as const;

  for (const pattern of patterns) {
    const match = normalizedValue.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function stripLegacyReleaseEditionFromName(
  value: string,
  edition: string | null,
): string {
  let normalizedValue = normalizeString(value).replace(/\s+/g, " ").trim();
  const editionPattern = edition
    ? escapeRegExp(edition).replace(/\\ /g, "\\s+")
    : "(?:Batch(?:\\s*(?:No\\.?|Number|#))?\\s*[A-Za-z0-9.-]+|(?:Chapter|Part|Vol(?:ume)?\\.?)\\s+[A-Za-z0-9IVXLCM.-]+|\\d+(?:st|nd|rd|th)\\s+Edition|\\d{4}\\s+Release)";
  const suffixPatterns = [
    new RegExp(`\\s*\\(${editionPattern}\\)\\s*$`, "i"),
    new RegExp(`\\s*[-–]\\s*${editionPattern}\\s*$`, "i"),
    new RegExp(`\\s+${editionPattern}\\s*$`, "i"),
  ];

  for (const pattern of suffixPatterns) {
    normalizedValue = normalizedValue.replace(pattern, "");
  }

  return normalizedValue.replace(/\s{2,}/g, " ").trim();
}

function buildEmptyProposedRelease(): ProposedRelease {
  return {
    edition: null,
    statedAge: null,
    abv: null,
    caskStrength: null,
    singleCask: null,
    vintageYear: null,
    releaseYear: null,
    description: null,
    tastingNotes: null,
    imageUrl: null,
  };
}

function proposedReleaseHasIdentity(release: ProposedRelease): boolean {
  return [
    release.edition,
    release.statedAge,
    release.abv,
    release.caskStrength,
    release.singleCask,
    release.vintageYear,
    release.releaseYear,
  ].some((value) => value !== null && value !== undefined);
}

function extractedIdentityHasReleaseSplitMarker(
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): boolean {
  return Boolean(
    extractedIdentity?.edition ||
    extractedIdentity?.release_year != null ||
    extractedIdentity?.vintage_year != null,
  );
}

function shouldUseExtractedAgeAsReleaseAge({
  parentCandidate,
  extractedIdentity,
}: {
  parentCandidate: BottleCandidate | null;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  if (extractedIdentity?.stated_age == null || !parentCandidate) {
    return false;
  }

  return !(
    parentCandidate.statedAge === extractedIdentity.stated_age &&
    candidateNameMarketsStatedAge(parentCandidate, extractedIdentity.stated_age)
  );
}

function buildProposedReleaseFromExtracted({
  reference,
  target,
  parentCandidate,
  extractedIdentity,
}: {
  reference: BottleReference;
  target: BottleCandidate | null;
  parentCandidate: BottleCandidate | null;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): ProposedRelease | null {
  const release = buildEmptyProposedRelease();
  release.edition =
    extractedIdentity?.edition ??
    extractLegacyReleaseEditionFromText(reference.name) ??
    extractLegacyReleaseEditionFromText(getCandidateFamilyName(target));
  release.releaseYear = extractedIdentity?.release_year ?? null;
  release.vintageYear = extractedIdentity?.vintage_year ?? null;
  release.abv = extractedIdentity?.abv ?? null;
  release.caskStrength = extractedIdentity?.cask_strength ?? null;
  release.singleCask = extractedIdentity?.single_cask ?? null;

  if (
    shouldUseExtractedAgeAsReleaseAge({
      parentCandidate,
      extractedIdentity,
    })
  ) {
    release.statedAge = extractedIdentity?.stated_age ?? null;
  }

  return proposedReleaseHasIdentity(release) ? release : null;
}

function buildProposedBottleFromExtracted({
  reference,
  extractedIdentity,
  fallbackCandidate,
  parentFullName,
  releaseUsesExtractedAge,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  fallbackCandidate: BottleCandidate | null;
  parentFullName?: string | null;
  releaseUsesExtractedAge?: boolean;
}): ProposedBottle | null {
  const brandName =
    extractedIdentity?.brand ?? fallbackCandidate?.brand ?? null;
  if (!brandName) {
    return null;
  }

  const rawName =
    parentFullName ??
    extractedIdentity?.expression ??
    extractedIdentity?.series ??
    stripDuplicateBrandPrefixFromBottleName(reference.name, brandName);
  let name = stripDuplicateBrandPrefixFromBottleName(rawName, brandName).trim();
  if (!name) {
    return null;
  }

  const statedAge = releaseUsesExtractedAge
    ? null
    : (extractedIdentity?.stated_age ?? fallbackCandidate?.statedAge ?? null);
  if (statedAge !== null && !comparableTextMarketsStatedAge(name, statedAge)) {
    name = normalizeBottle({
      name,
      statedAge,
    }).name;
  }

  return {
    name,
    series: extractedIdentity?.series
      ? {
          id: null,
          name: extractedIdentity.series,
        }
      : null,
    category:
      extractedIdentity?.category ?? fallbackCandidate?.category ?? null,
    edition: null,
    statedAge,
    caskStrength: extractedIdentity?.cask_strength ?? null,
    singleCask: extractedIdentity?.single_cask ?? null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: {
      id: null,
      name: brandName,
    },
    distillers:
      (extractedIdentity?.distillery ?? []).map((name) => ({
        id: null,
        name,
      })) ?? [],
    bottler: extractedIdentity?.bottler
      ? {
          id: null,
          name: extractedIdentity.bottler,
        }
      : null,
  };
}

function getReferenceBottleName({
  reference,
  brandName,
  extractedBrand,
}: {
  reference: BottleReference;
  brandName: string;
  extractedBrand: string | null | undefined;
}): string {
  return stripDuplicateBrandPrefixFromBottleName(
    stripDuplicateBrandPrefixFromBottleName(reference.name, brandName),
    extractedBrand,
  ).trim();
}

function stripReferenceBottleSuffixNoise(name: string): string {
  return name
    .replace(/\b(?:scotch\s+)?whisk(?:e)?y\b\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function restoreSparseAgeOnlyBottleName({
  reference,
  extractedIdentity,
  proposedBottle,
  forceAgeStatement = false,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  forceAgeStatement?: boolean;
}): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  const statedAge = proposedBottle.statedAge ?? extractedIdentity?.stated_age;
  const normalizedProposedName = normalizeComparableText(proposedBottle.name);
  const ageStrippedProposedName = stripComparableAgeStatement(
    normalizedProposedName,
    statedAge,
  );
  const isAgeOnlyName =
    !ageStrippedProposedName || normalizedProposedName === String(statedAge);
  if (statedAge === null || statedAge === undefined) {
    return proposedBottle;
  }

  if (
    forceAgeStatement &&
    !isAgeOnlyName &&
    comparableTextMarketsStatedAge(reference.name, statedAge) &&
    !comparableTextMarketsStatedAge(proposedBottle.name, statedAge)
  ) {
    const normalizedName = normalizeBottle({
      name: proposedBottle.name,
      statedAge,
    }).name;

    return {
      ...proposedBottle,
      name: comparableTextMarketsStatedAge(normalizedName, statedAge)
        ? normalizedName
        : `${normalizedName} ${statedAge}-year-old`,
      statedAge,
    };
  }

  const referenceBottleName = stripReferenceBottleSuffixNoise(
    getReferenceBottleName({
      reference,
      brandName: proposedBottle.brand.name,
      extractedBrand: extractedIdentity?.brand,
    }),
  );
  if (
    !isAgeOnlyName ||
    !referenceBottleName ||
    referenceBottleName.length > 120 ||
    !comparableTextMarketsStatedAge(referenceBottleName, statedAge) ||
    normalizeComparableText(referenceBottleName) ===
      normalizeComparableText(proposedBottle.name)
  ) {
    return proposedBottle;
  }

  return {
    ...proposedBottle,
    name: referenceBottleName,
    statedAge,
  };
}

function shouldRestoreMissingBottleAgeStatement(
  missingTraits: string[],
): boolean {
  return missingTraits.length === 1 && missingTraits[0] === "statedAge";
}

function restoreExactCaskBottleDisplayName({
  reference,
  extractedIdentity,
  proposedBottle,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
}): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  let name = proposedBottle.name;
  const statedAge = proposedBottle.statedAge ?? extractedIdentity?.stated_age;
  const vintageYear =
    proposedBottle.vintageYear ?? extractedIdentity?.vintage_year;

  if (
    statedAge !== null &&
    statedAge !== undefined &&
    (comparableTextMarketsStatedAge(reference.name, statedAge) ||
      extractedIdentity?.stated_age === statedAge) &&
    !comparableTextMarketsStatedAge(name, statedAge)
  ) {
    name = `${name} ${statedAge}-year-old`;
  }

  if (
    vintageYear !== null &&
    vintageYear !== undefined &&
    (normalizeComparableText(reference.name).includes(String(vintageYear)) ||
      extractedIdentity?.vintage_year === vintageYear) &&
    !normalizeComparableText(name).includes(String(vintageYear))
  ) {
    name = `${name} ${vintageYear}`;
  }

  return name === proposedBottle.name
    ? proposedBottle
    : {
        ...proposedBottle,
        name: normalizeString(name),
      };
}

function sourceMarketsProposedBottleAge({
  reference,
  extractedIdentity,
  statedAge,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  statedAge: number | null | undefined;
}): boolean {
  if (statedAge === null || statedAge === undefined) {
    return false;
  }

  return (
    comparableTextMarketsStatedAge(reference.name, statedAge) ||
    extractedIdentity?.stated_age === statedAge
  );
}

function proposedBottleNameMarketsStatedAge({
  proposedBottle,
  statedAge,
}: {
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  statedAge: number | null | undefined;
}): boolean {
  if (statedAge === null || statedAge === undefined) {
    return false;
  }

  return (
    comparableTextMarketsStatedAge(proposedBottle.name, statedAge) ||
    comparableTextMarketsWordAge(proposedBottle.name, statedAge) ||
    comparableTextMarketsStatedAge(
      normalizeBottle({
        name: proposedBottle.name,
        statedAge: null,
      }).name,
      statedAge,
    )
  );
}

function getComparableAgeWordPhrase(statedAge: number): string | null {
  if (statedAge >= 1 && statedAge < 10) {
    return AGE_WORD_ONES[statedAge] ?? null;
  }

  if (statedAge >= 10 && statedAge < 20) {
    return AGE_WORD_TEENS[statedAge - 10] ?? null;
  }

  if (statedAge >= 20 && statedAge < 100) {
    const tens = Math.floor(statedAge / 10) * 10;
    const ones = statedAge % 10;
    const tensWord = AGE_WORD_TENS[tens];
    const onesWord = AGE_WORD_ONES[ones];
    if (!tensWord) {
      return null;
    }

    return onesWord ? `${tensWord} ${onesWord}` : tensWord;
  }

  return null;
}

function comparableTextMarketsWordAge(
  value: string | null | undefined,
  statedAge: number | null | undefined,
): boolean {
  if (!value || statedAge === null || statedAge === undefined) {
    return false;
  }

  const ageWords = getComparableAgeWordPhrase(statedAge);
  if (!ageWords) {
    return false;
  }

  const normalizedValue = normalizeComparableText(value).replace(/-/g, " ");
  return containsComparablePhrase(normalizedValue, ageWords);
}

function getComparableBottleFamilyName({
  name,
  brandName,
  statedAge,
}: {
  name: string;
  brandName: string;
  statedAge: number | null | undefined;
}): string {
  const ageStrippedName = stripComparableAgeStatement(name, statedAge);
  const normalizedName = normalizeComparableText(ageStrippedName);
  const normalizedBrandName = normalizeComparableText(brandName);

  if (
    normalizedBrandName &&
    normalizedName.startsWith(`${normalizedBrandName} `)
  ) {
    return normalizedName.slice(normalizedBrandName.length).trim();
  }

  return normalizedName;
}

function bottleFamilyNamesOverlap(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return left === right || containsComparablePhrase(left, right);
}

function hasSameFamilyBottleAgeConflict({
  artifacts,
  proposedBottle,
  statedAge,
}: {
  artifacts: BottleClassificationArtifacts;
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  statedAge: number | null | undefined;
}): boolean {
  if (statedAge === null || statedAge === undefined) {
    return false;
  }

  const proposedFamilyName = getComparableBottleFamilyName({
    name: proposedBottle.name,
    brandName: proposedBottle.brand.name,
    statedAge,
  });
  if (!proposedFamilyName) {
    return false;
  }

  const siblingRows = new Map<
    number,
    {
      fullName: string;
      statedAge: number | null | undefined;
    }
  >();

  for (const candidate of artifacts.candidates) {
    siblingRows.set(candidate.bottleId, {
      fullName: candidate.bottleFullName ?? candidate.fullName,
      statedAge: candidate.statedAge,
    });

    for (const sibling of candidate.familyContext?.siblingBottles ?? []) {
      siblingRows.set(sibling.bottleId, {
        fullName: sibling.fullName,
        statedAge: sibling.statedAge,
      });
    }
  }

  for (const sibling of siblingRows.values()) {
    if (
      sibling.statedAge === null ||
      sibling.statedAge === undefined ||
      sibling.statedAge === statedAge
    ) {
      continue;
    }

    const siblingFamilyName = getComparableBottleFamilyName({
      name: sibling.fullName,
      brandName: proposedBottle.brand.name,
      statedAge: sibling.statedAge,
    });
    if (bottleFamilyNamesOverlap(proposedFamilyName, siblingFamilyName)) {
      return true;
    }
  }

  return false;
}

function getCreateBottleDisplayIdentityMissingTraits({
  reference,
  extractedIdentity,
  artifacts,
  proposedBottle,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  artifacts: BottleClassificationArtifacts;
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
}): string[] {
  const missingTraits: string[] = [];
  const statedAge = proposedBottle.statedAge;

  if (
    sourceMarketsProposedBottleAge({
      reference,
      extractedIdentity,
      statedAge,
    }) &&
    hasSameFamilyBottleAgeConflict({
      artifacts,
      proposedBottle,
      statedAge,
    }) &&
    !proposedBottleNameMarketsStatedAge({
      proposedBottle,
      statedAge,
    })
  ) {
    missingTraits.push("statedAge");
  }

  return missingTraits;
}

function getLegacyReleaseParentNameCandidate(
  candidate: BottleCandidate,
): string {
  const releaseEdition =
    candidate.edition ??
    extractLegacyReleaseEditionFromText(getCandidateFamilyName(candidate));

  return stripLegacyReleaseEditionFromName(
    getCandidateFamilyName(candidate),
    releaseEdition,
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

function getCreationEvidenceTokens(value: string | null | undefined) {
  return normalizeNameTokenizationText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9']+/g)
    .flatMap(expandComparableEvidenceToken)
    .map((token) => token.replace(/'/g, ""))
    .filter(
      (token) =>
        token.length > 0 && !CREATION_EVIDENCE_GENERIC_TOKENS.has(token),
    );
}

function getCreateReleaseParentCandidate({
  decision,
  artifacts,
}: {
  decision: { parentBottleId: number | null };
  artifacts: BottleClassificationArtifacts;
}) {
  if (decision.parentBottleId === null) {
    return null;
  }

  return (
    artifacts.candidates.find(
      (candidate) =>
        candidate.bottleId === decision.parentBottleId &&
        candidate.releaseId === null,
    ) ??
    artifacts.candidates.find(
      (candidate) => candidate.bottleId === decision.parentBottleId,
    ) ??
    null
  );
}

function getParentReleaseTraitConflicts({
  parentCandidate,
  release,
}: {
  parentCandidate: BottleCandidate;
  release: ProposedRelease;
}): string[] {
  const conflicts: string[] = [];
  const fields = [
    ["statedAge", parentCandidate.statedAge, release.statedAge],
    ["edition", parentCandidate.edition, release.edition],
    ["releaseYear", parentCandidate.releaseYear, release.releaseYear],
    ["vintageYear", parentCandidate.vintageYear, release.vintageYear],
    ["abv", parentCandidate.abv, release.abv],
    ["caskStrength", parentCandidate.caskStrength, release.caskStrength],
    ["singleCask", parentCandidate.singleCask, release.singleCask],
  ] as const;

  for (const [field, parentValue, releaseValue] of fields) {
    if (
      parentValue !== null &&
      parentValue !== undefined &&
      releaseValue !== null &&
      releaseValue !== undefined &&
      parentValue !== releaseValue
    ) {
      conflicts.push(field);
    }
  }

  return conflicts;
}

function appendReleaseIdentityName(
  baseName: string,
  release: ProposedRelease | null,
) {
  if (!release) {
    return baseName;
  }

  return [
    baseName,
    release.edition,
    release.statedAge != null ? `${release.statedAge} year` : null,
    release.releaseYear,
    release.vintageYear,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getCreationEvidenceNameCandidates({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}) {
  const names: string[] = [];

  if (decision.proposedBottle) {
    names.push(...getProposedBottleNameCandidates(decision.proposedBottle));
  }

  const parentCandidate = getCreateReleaseParentCandidate({
    decision,
    artifacts,
  });
  if (parentCandidate) {
    names.push(
      ...[
        parentCandidate.alias,
        parentCandidate.bottleFullName,
        parentCandidate.fullName,
      ].filter((name): name is string => Boolean(name)),
    );
  }

  if (decision.proposedRelease) {
    for (const baseName of [...names]) {
      names.push(appendReleaseIdentityName(baseName, decision.proposedRelease));
    }
  }

  if (!names.length) {
    names.push(
      [
        artifacts.extractedIdentity?.brand,
        artifacts.extractedIdentity?.series,
        artifacts.extractedIdentity?.expression,
        artifacts.extractedIdentity?.edition,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  names.push(decision.observation?.caskNumber ?? "");
  names.push(decision.observation?.barrelNumber ?? "");

  return Array.from(
    new Set(names.map((name) => name.trim()).filter((name) => name.length > 0)),
  );
}

function searchResultSupportsCreationDecision({
  evidence,
  result,
  decision,
  artifacts,
}: {
  evidence: BottleClassificationArtifacts["searchEvidence"][number];
  result: BottleClassificationArtifacts["searchEvidence"][number]["results"][number];
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}) {
  const resultTokens = new Set(
    getCreationEvidenceTokens(getSearchEvidenceText(evidence, result)),
  );
  if (!resultTokens.size) {
    return false;
  }

  return getCreationEvidenceNameCandidates({
    decision,
    artifacts,
  })
    .map((name) => getCreationEvidenceTokens(name))
    .filter((tokens) => tokens.length >= 2)
    .some((tokens) => tokens.every((token) => resultTokens.has(token)));
}

function hasSupportiveExternalWebEvidenceForCreation({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  if (decision.confidenceBasis?.webEvidence !== "supportive") {
    return false;
  }

  const sourceDomain = getComparableDomain(reference.url ?? "");

  for (const evidence of artifacts.searchEvidence) {
    for (const result of evidence.results) {
      const resultDomain = getComparableDomain(result.url);
      if (
        sourceDomain &&
        resultDomain &&
        domainMatches(resultDomain, sourceDomain)
      ) {
        continue;
      }

      if (
        !searchResultSupportsCreationDecision({
          evidence,
          result,
          decision,
          artifacts,
        })
      ) {
        continue;
      }

      return true;
    }
  }

  return false;
}

function hasSmwsCodeAnchoredCreationEvidence({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  if (
    decision.action !== "create_bottle" ||
    decision.identityScope !== "exact_cask" ||
    !decision.proposedBottle
  ) {
    return false;
  }

  return (
    getSmwsCodeAnchor({
      reference,
      decision,
      artifacts,
    }) !== null
  );
}

function hasCreationEvidence({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  return (
    hasSmwsCodeAnchoredCreationEvidence({
      reference,
      decision,
      artifacts,
    }) ||
    hasSupportiveExternalWebEvidenceForCreation({
      reference,
      decision,
      artifacts,
    })
  );
}

function hasLocalParentAnchoredReleaseCreationEvidence({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  if (
    (decision.action !== "create_release" &&
      decision.action !== "repair_parent_and_create_release") ||
    !decision.proposedRelease ||
    decision.parentBottleId === null
  ) {
    return false;
  }

  const parentCandidate = getCreateReleaseParentCandidate({
    decision,
    artifacts,
  });
  if (
    !parentCandidate ||
    !candidateHasLocalParentAnchorSource(parentCandidate) ||
    !candidateMatchesLocalParentAnchor({
      candidate: parentCandidate,
      extractedIdentity: artifacts.extractedIdentity,
    })
  ) {
    return false;
  }

  return Boolean(
    decision.proposedRelease.edition ||
    decision.proposedRelease.releaseYear !== null ||
    decision.proposedRelease.vintageYear !== null ||
    (decision.proposedRelease.statedAge !== null &&
      !candidateNameMarketsStatedAge(
        parentCandidate,
        decision.proposedRelease.statedAge,
      )),
  );
}

function hasLocalSiblingAnchoredBottleAndReleaseCreationEvidence({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  if (
    decision.action !== "create_bottle_and_release" ||
    !decision.proposedBottle ||
    !decision.proposedRelease ||
    !decision.proposedRelease.edition
  ) {
    return false;
  }

  const proposedParentName = normalizeComparableText(
    [
      decision.proposedBottle.brand.name,
      decision.proposedBottle.series?.name,
      decision.proposedBottle.name,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!proposedParentName) {
    return false;
  }

  const siblingCount = artifacts.candidates.filter((candidate) => {
    if (
      !candidateLooksLikeLegacyReleaseBottle(candidate) ||
      !candidateMatchesExtractedFamily({
        candidate,
        extractedIdentity: artifacts.extractedIdentity,
      })
    ) {
      return false;
    }

    return textsOverlap(
      getLegacyReleaseParentNameCandidate(candidate),
      proposedParentName,
    );
  }).length;

  return siblingCount >= 2;
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
  };
}

function getMatchedTarget(
  decision: BottleClassificationDecision,
  candidates: BottleCandidate[],
): BottleCandidate | null {
  if (decision.action !== "match" && decision.action !== "repair_bottle") {
    return null;
  }

  return (
    candidates.find(
      (candidate) =>
        candidate.bottleId === decision.matchedBottleId &&
        (decision.action === "match" && decision.matchedReleaseId != null
          ? candidate.releaseId === decision.matchedReleaseId
          : candidate.releaseId === null || candidate.kind === "bottle"),
    ) ?? null
  );
}

function maybeResolveExactCaskCreateToExistingMatch({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  if (
    decision.action !== "create_bottle" ||
    decision.identityScope !== "exact_cask" ||
    !decision.proposedBottle
  ) {
    return null;
  }

  const exactCaskAnchor =
    getExactCaskCodeAnchor(decision.observation?.caskNumber) ??
    getExactCaskCodeAnchor(decision.proposedBottle?.name) ??
    getExactCaskCodeAnchor(artifacts.extractedIdentity?.edition) ??
    getExactCaskCodeAnchor(artifacts.extractedIdentity?.expression);

  if (!exactCaskAnchor) {
    return null;
  }

  const proposedBottle = decision.proposedBottle;
  const existingTarget =
    artifacts.candidates
      .filter(
        (candidate) =>
          candidateHasExactCaskCodeAnchor(candidate, exactCaskAnchor) &&
          candidateMatchesProposedBottleDraftIdentity({
            target: candidate,
            proposedBottle,
          }) &&
          !proposedBottleHasKnownTargetConflict({
            target: candidate,
            proposedBottle,
            extractedIdentity: artifacts.extractedIdentity,
          }),
      )
      .sort((left, right) => {
        if (left.source.includes("exact") !== right.source.includes("exact")) {
          return left.source.includes("exact") ? -1 : 1;
        }

        return (right.score ?? 0) - (left.score ?? 0);
      })[0] ?? null;

  if (!existingTarget) {
    return null;
  }

  return {
    action: "match",
    confidence: decision.confidence,
    rationale: appendRationale(
      decision.rationale,
      "Server resolved exact-cask creation to the existing local bottle because the exact code anchor already exists.",
    ),
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: "exact_cask",
    observation: decision.observation,
    matchedBottleId: existingTarget.bottleId,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle: null,
    proposedRelease: null,
  };
}

function getTargetNameCandidates(
  target: BottleCandidate,
  decision: BottleClassificationDecision,
): string[] {
  const structuredReleaseNames =
    (decision.action === "match" &&
      (decision.matchedReleaseId != null || target.kind === "release")) ||
    target.releaseId != null
      ? [
          target.bottleFullName && target.releaseYear != null
            ? `${target.bottleFullName} ${target.releaseYear}`
            : null,
          target.bottleFullName && target.vintageYear != null
            ? `${target.bottleFullName} ${target.vintageYear}`
            : null,
          target.bottleFullName && target.edition
            ? `${target.bottleFullName} ${target.edition}`
            : null,
        ]
      : [];
  const names =
    decision.action === "match" &&
    (decision.matchedReleaseId != null || target.kind === "release")
      ? [target.alias, target.fullName, ...structuredReleaseNames]
      : [
          target.alias,
          target.bottleFullName ?? target.fullName,
          target.fullName,
          ...structuredReleaseNames,
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

function getProposedBottleNameCandidates(proposedBottle: ProposedBottle) {
  return Array.from(
    new Set(
      [
        proposedBottle.name,
        `${proposedBottle.brand.name} ${proposedBottle.name}`,
        proposedBottle.series
          ? `${proposedBottle.brand.name} ${proposedBottle.series.name} ${proposedBottle.name}`
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function stringListsOverlap(
  actualValues: string[],
  expectedValues: string[],
): boolean {
  if (!actualValues.length || !expectedValues.length) {
    return false;
  }

  return expectedValues.every((expectedValue) =>
    actualValues.some((actualValue) =>
      textsOverlap(actualValue, expectedValue),
    ),
  );
}

function candidateMatchesProposedBottleDraftIdentity({
  target,
  proposedBottle,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
}): boolean {
  const targetNames = getBottleTargetNameCandidates(target);
  const proposedNames = getProposedBottleNameCandidates(proposedBottle);
  const brandMatches =
    textsOverlap(target.brand, proposedBottle.brand.name) ||
    targetNames.some((name) => textsOverlap(name, proposedBottle.brand.name));
  const nameMatches = proposedNames.some((proposedName) =>
    targetNames.some((targetName) => textsOverlap(targetName, proposedName)),
  );

  if (!brandMatches || !nameMatches) {
    return false;
  }

  if (!proposedBottle.series) {
    return true;
  }

  return (
    textsOverlap(target.series, proposedBottle.series.name) ||
    targetNames.some((name) => textsOverlap(name, proposedBottle.series?.name))
  );
}

function proposedBottleChangesOnlyLegacyGenericCategory({
  target,
  proposedBottle,
  extractedIdentity,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}) {
  return (
    target.category === "spirit" &&
    proposedBottle.category !== null &&
    proposedBottle.category === extractedIdentity?.category
  );
}

function proposedBottleNeedsMaterialTargetRepair({
  target,
  proposedBottle,
  extractedIdentity,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  if (
    target.brand &&
    !textsOverlap(target.brand, proposedBottle.brand.name) &&
    !getBottleTargetNameCandidates(target).some((name) =>
      textsOverlap(name, proposedBottle.brand.name),
    )
  ) {
    return true;
  }

  if (
    proposedBottle.category !== null &&
    target.category !== proposedBottle.category &&
    !proposedBottleChangesOnlyLegacyGenericCategory({
      target,
      proposedBottle,
      extractedIdentity,
    })
  ) {
    return true;
  }

  if (
    proposedBottle.series &&
    !textsOverlap(target.series, proposedBottle.series.name)
  ) {
    return true;
  }

  if (
    proposedBottle.bottler &&
    !textsOverlap(target.bottler, proposedBottle.bottler.name)
  ) {
    return true;
  }

  if (
    proposedBottle.distillers.length > 0 &&
    target.distillery.length > 0 &&
    !stringListsOverlap(
      target.distillery,
      proposedBottle.distillers.map((distiller) => distiller.name),
    )
  ) {
    return true;
  }

  if (
    proposedBottle.statedAge !== null &&
    target.statedAge !== proposedBottle.statedAge
  ) {
    return true;
  }

  if (
    proposedBottle.edition &&
    !textsOverlap(target.edition, proposedBottle.edition)
  ) {
    return true;
  }

  if (
    proposedBottle.caskStrength !== null &&
    target.caskStrength !== proposedBottle.caskStrength
  ) {
    return true;
  }

  if (
    proposedBottle.singleCask !== null &&
    target.singleCask !== proposedBottle.singleCask
  ) {
    return true;
  }

  if (proposedBottle.abv !== null && target.abv !== proposedBottle.abv) {
    return true;
  }

  if (
    proposedBottle.vintageYear !== null &&
    target.vintageYear !== proposedBottle.vintageYear
  ) {
    return true;
  }

  if (
    proposedBottle.releaseYear !== null &&
    target.releaseYear !== proposedBottle.releaseYear
  ) {
    return true;
  }

  return false;
}

function proposedBottleRemovesReleaseTraits({
  target,
  proposedBottle,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
}): boolean {
  return [
    [target.statedAge, proposedBottle.statedAge],
    [target.edition, proposedBottle.edition],
    [target.releaseYear, proposedBottle.releaseYear],
    [target.vintageYear, proposedBottle.vintageYear],
    [target.abv, proposedBottle.abv],
    [target.caskStrength, proposedBottle.caskStrength],
    [target.singleCask, proposedBottle.singleCask],
  ].some(
    ([targetValue, proposedValue]) =>
      targetValue !== null &&
      targetValue !== undefined &&
      (proposedValue === null || proposedValue === undefined),
  );
}

function proposedBottleHasKnownTargetConflict({
  target,
  proposedBottle,
  extractedIdentity,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  return proposedBottleNeedsMaterialTargetRepair({
    target,
    proposedBottle: {
      ...proposedBottle,
      abv: target.abv === null ? null : proposedBottle.abv,
      caskStrength:
        target.caskStrength === null ? null : proposedBottle.caskStrength,
      singleCask: target.singleCask === null ? null : proposedBottle.singleCask,
    },
    extractedIdentity,
  });
}

function findDuplicateCreateBottleCandidate({
  reference,
  proposedBottle,
  artifacts,
  observation,
  requestedIdentityScope,
}: {
  reference: BottleReference;
  proposedBottle: ProposedBottle;
  artifacts: BottleClassificationArtifacts;
  observation: BottleObservation | null;
  requestedIdentityScope: BottleClassifierAgentDecision["identityScope"] | null;
}): BottleCandidate | null {
  if (
    requestedIdentityScope === "exact_cask" &&
    hasExactCaskSignals({
      reference,
      proposedBottle,
      extractedIdentity: artifacts.extractedIdentity,
      observation,
    })
  ) {
    return null;
  }

  const proposedNames = getProposedBottleNameCandidates(proposedBottle);
  return (
    artifacts.candidates
      .filter((candidate) => {
        if (
          candidate.kind !== "bottle" ||
          candidate.releaseId !== null ||
          candidateLooksLikeLegacyReleaseBottle(candidate)
        ) {
          return false;
        }

        if (
          proposedBottleHasKnownTargetConflict({
            target: candidate,
            proposedBottle,
            extractedIdentity: artifacts.extractedIdentity,
          })
        ) {
          return false;
        }

        return proposedNames.some((proposedName) =>
          getBottleTargetNameCandidates(candidate).some(
            (targetName) =>
              isStrictlyExactNameMatch(proposedName, targetName) ||
              isPossessiveInsensitiveExactNameMatch(
                proposedName,
                targetName,
                true,
              ),
          ),
        );
      })
      .sort((left, right) => {
        if (left.source.includes("exact") !== right.source.includes("exact")) {
          return left.source.includes("exact") ? -1 : 1;
        }

        return (right.score ?? 0) - (left.score ?? 0);
      })[0] ?? null
  );
}

function maybeSplitMisScopedExactCaskBottleCreation({
  reference,
  decision,
  artifacts,
  proposedBottle,
  observation,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  observation: BottleObservation | null;
}): BottleClassificationDecision | null {
  if (
    decision.action !== "create_bottle" ||
    decision.identityScope !== "exact_cask" ||
    getSmwsCodeAnchor({ reference, decision, artifacts }) ||
    observation?.caskNumber ||
    observation?.barrelNumber ||
    (proposedBottle.releaseYear === null && proposedBottle.vintageYear === null)
  ) {
    return null;
  }

  const parentDraft = buildProposedBottleFromExtracted({
    reference,
    extractedIdentity: artifacts.extractedIdentity,
    fallbackCandidate: null,
    releaseUsesExtractedAge: true,
  }) ?? {
    ...proposedBottle,
    edition: null,
    statedAge: null,
    abv: null,
    caskStrength: null,
    singleCask: null,
    vintageYear: null,
    releaseYear: null,
  };
  const release: ProposedRelease = {
    ...buildEmptyProposedRelease(),
    edition: proposedBottle.edition,
    statedAge: proposedBottle.statedAge,
    abv: proposedBottle.abv,
    caskStrength: proposedBottle.caskStrength,
    singleCask: proposedBottle.singleCask,
    vintageYear: proposedBottle.vintageYear,
    releaseYear: proposedBottle.releaseYear,
  };
  const normalizedDrafts = normalizeBottleCreationDrafts({
    creationTarget: "bottle_and_release",
    proposedBottle: parentDraft,
    proposedRelease: release,
  });

  if (!normalizedDrafts.proposedBottle || !normalizedDrafts.proposedRelease) {
    return null;
  }

  return {
    action: "create_bottle_and_release",
    confidence: decision.confidence,
    rationale: appendRationale(
      decision.rationale,
      "Server redirected exact-cask bottle creation to bottle-and-release creation because the non-SMWS identity only had year-level release traits, not an exact cask anchor.",
    ),
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: "product",
    observation,
    identityBasis: decision.identityBasis,
    confidenceBasis: decision.confidenceBasis,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle: normalizedDrafts.proposedBottle,
    proposedRelease: normalizedDrafts.proposedRelease,
  };
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
  > &
    Partial<
      Pick<BottleClassifierAgentDecision, "identityBasis" | "confidenceBasis">
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
    identityBasis: decision.identityBasis ?? null,
    confidenceBasis: decision.confidenceBasis ?? null,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle: null,
    proposedRelease: null,
  };
}

function rejectInvalidExistingMatch({
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
  if (!target) {
    return createNoMatchDecision({
      decision,
      candidateBottleIds: decision.candidateBottleIds,
      observation: decision.observation,
      identityScope: decision.identityScope,
      rationale: appendRationale(
        decision.rationale,
        "Server downgraded the existing-match recommendation because the matched target was not present in the reviewed candidates.",
      ),
    });
  }

  const identityConflicts = getExistingMatchIdentityConflicts({
    referenceName: reference.name,
    targetCandidate: target,
    extractedLabel: artifacts.extractedIdentity,
  });
  if (!identityConflicts.length) {
    return decision;
  }

  const downgradedRationale = appendRationale(
    decision.rationale,
    `Server downgraded the existing-match recommendation because the candidate conflicts with extracted reference details (${identityConflicts.join(
      "; ",
    )}).`,
  );
  return createNoMatchDecision({
    decision,
    candidateBottleIds: decision.candidateBottleIds,
    observation: decision.observation,
    identityScope: decision.identityScope,
    rationale: downgradedRationale,
  });
}

function capUnverifiedCreationAutomation({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  if (
    decision.action !== "create_bottle" &&
    decision.action !== "create_release" &&
    decision.action !== "create_bottle_and_release" &&
    decision.action !== "repair_parent_and_create_release"
  ) {
    return decision;
  }

  if (
    hasSupportiveExternalWebEvidenceForCreation({
      reference,
      decision,
      artifacts,
    }) ||
    hasSmwsCodeAnchoredCreationEvidence({
      reference,
      decision,
      artifacts,
    }) ||
    hasLocalParentAnchoredReleaseCreationEvidence({
      decision,
      artifacts,
    }) ||
    hasLocalSiblingAnchoredBottleAndReleaseCreationEvidence({
      decision,
      artifacts,
    })
  ) {
    return decision;
  }

  if (decision.confidenceBasis?.band !== "auto_verification") {
    return decision;
  }

  return {
    ...decision,
    confidence: Math.min(decision.confidence, 94),
    rationale: appendRationale(
      decision.rationale,
      "Server moved creation out of automatic verification because supporting source evidence or a deterministic anchor was not available.",
    ),
    confidenceBasis: {
      ...decision.confidenceBasis,
      band: "review",
    },
  };
}

function capAutoVerificationWithUnresolvedRisks(
  decision: BottleClassificationDecision,
): BottleClassificationDecision {
  const confidenceBasis = decision.confidenceBasis;
  if (
    confidenceBasis?.band !== "auto_verification" ||
    confidenceBasis.unresolvedRisks.length === 0
  ) {
    return decision;
  }

  return {
    ...decision,
    confidence: Math.min(decision.confidence, 94),
    rationale: appendRationale(
      decision.rationale,
      "Server moved the decision out of automatic verification because the classifier reported unresolved risks.",
    ),
    confidenceBasis: {
      ...confidenceBasis,
      band: "review",
    },
  };
}

function capIneligibleExistingMatchAutoVerification({
  reference,
  decision,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
}): BottleClassificationDecision {
  const confidenceBasis = decision.confidenceBasis;
  if (
    decision.action !== "match" ||
    confidenceBasis?.band !== "auto_verification" ||
    isExistingMatchConfidenceEligibleForVerification({
      confidence: decision.confidence,
      currentBottleId: reference.currentBottleId ?? null,
      currentReleaseId: reference.currentReleaseId ?? null,
      identityScope: decision.identityScope,
      matchedBottleId: decision.matchedBottleId,
      matchedReleaseId: decision.matchedReleaseId,
    })
  ) {
    return decision;
  }

  return {
    ...decision,
    confidence: Math.min(decision.confidence, 94),
    rationale: appendRationale(
      decision.rationale,
      "Server moved the existing match out of automatic verification because downstream verification is not eligible for this assignment context.",
    ),
    confidenceBasis: {
      ...confidenceBasis,
      band: "review",
    },
  };
}

function textLooksLikeUnsupportedHouseCategoryStyle(
  value: string | null | undefined,
): boolean {
  const normalizedValue = normalizeComparableText(value);
  if (!normalizedValue || /\bsingle\s+malt\b/.test(normalizedValue)) {
    return false;
  }

  return /\b(?:straight\s+)?malt\s+whisk(?:e)?y\b/.test(normalizedValue);
}

function maybeRemoveUnsupportedStyleBottleCategory({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  if (
    (decision.action !== "create_bottle" &&
      decision.action !== "create_bottle_and_release") ||
    !decision.proposedBottle ||
    decision.proposedBottle.category === null ||
    artifacts.extractedIdentity?.category !== null
  ) {
    return null;
  }

  if (
    ![
      reference.name,
      artifacts.extractedIdentity?.expression,
      decision.proposedBottle.name,
    ].some(textLooksLikeUnsupportedHouseCategoryStyle)
  ) {
    return null;
  }

  return {
    ...decision,
    rationale: appendRationale(
      decision.rationale,
      "Server removed the proposed bottle category because the source style is not represented by a house category.",
    ),
    proposedBottle: {
      ...decision.proposedBottle,
      category: null,
    },
  };
}

function maybeRestoreUnsupportedStyleBottleName({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  if (
    (decision.action !== "create_bottle" &&
      decision.action !== "create_bottle_and_release") ||
    !decision.proposedBottle ||
    decision.proposedBottle.category !== null ||
    !artifacts.extractedIdentity?.expression
  ) {
    return null;
  }

  const referenceBottleName = getReferenceBottleName({
    reference,
    brandName: decision.proposedBottle.brand.name,
    extractedBrand: artifacts.extractedIdentity.brand,
  });
  if (
    !referenceBottleName ||
    referenceBottleName.length > 120 ||
    !textsOverlap(
      referenceBottleName,
      artifacts.extractedIdentity.expression,
    ) ||
    normalizeComparableText(referenceBottleName) ===
      normalizeComparableText(decision.proposedBottle.name)
  ) {
    return null;
  }

  return {
    ...decision,
    rationale: appendRationale(
      decision.rationale,
      "Server restored the proposed bottle name from the extracted expression because the unsupported style has no house category bucket.",
    ),
    proposedBottle: {
      ...decision.proposedBottle,
      name: referenceBottleName,
    },
  };
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

    return {
      action: "match",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
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

    const sanitizedBottleDraft = normalizeSmwsExactCaskProposedBottleDraft({
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: restoreSparseAgeOnlyBottleName({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: sanitizeProposedBottleDraft(
          decision.proposedBottle,
          resolvedEntitiesById,
        ),
      }),
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

    let proposedBottleDraft = normalizedDrafts.proposedBottle;
    if ((decision.identityScope ?? "product") === "exact_cask") {
      proposedBottleDraft = restoreExactCaskBottleDisplayName({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: proposedBottleDraft,
      });
    }

    if ((decision.identityScope ?? "product") !== "exact_cask") {
      const displayIdentityMissingTraits =
        getCreateBottleDisplayIdentityMissingTraits({
          reference,
          extractedIdentity: artifacts.extractedIdentity,
          artifacts,
          proposedBottle: proposedBottleDraft,
        });

      if (
        shouldRestoreMissingBottleAgeStatement(displayIdentityMissingTraits)
      ) {
        const ageRestoredBottleDraft = restoreSparseAgeOnlyBottleName({
          reference,
          extractedIdentity: artifacts.extractedIdentity,
          proposedBottle: proposedBottleDraft,
          forceAgeStatement: true,
        });
        proposedBottleDraft =
          normalizeBottleCreationDrafts({
            creationTarget: "bottle",
            proposedBottle: ageRestoredBottleDraft,
            proposedRelease: null,
          }).proposedBottle ?? proposedBottleDraft;
      }
    }

    const splitExactCaskDecision = maybeSplitMisScopedExactCaskBottleCreation({
      reference,
      decision: {
        ...decision,
        action: "create_bottle",
        confidence: normalizedConfidence,
        identityScope: decision.identityScope ?? "product",
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: proposedBottleDraft,
        proposedRelease: null,
      },
      artifacts,
      proposedBottle: proposedBottleDraft,
      observation,
    });
    if (splitExactCaskDecision) {
      return splitExactCaskDecision;
    }

    if ((decision.identityScope ?? "product") !== "exact_cask") {
      const displayIdentityMissingTraits =
        getCreateBottleDisplayIdentityMissingTraits({
          reference,
          extractedIdentity: artifacts.extractedIdentity,
          artifacts,
          proposedBottle: proposedBottleDraft,
        });
      if (displayIdentityMissingTraits.length > 0) {
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
            `Server downgraded create_bottle because the proposed bottle display name omits bottle-level traits (${displayIdentityMissingTraits.join(
              "; ",
            )}) that the source markets and the agent put on the bottle; choose a release action or include those traits in proposedBottle.name.`,
          ),
        });
      }
    }

    const duplicateBottleCandidate = findDuplicateCreateBottleCandidate({
      reference,
      proposedBottle: proposedBottleDraft,
      artifacts,
      observation,
      requestedIdentityScope: decision.identityScope,
    });
    if (duplicateBottleCandidate) {
      return createNoMatchDecision({
        decision: {
          ...decision,
          confidence: normalizedConfidence,
        },
        candidateBottleIds: Array.from(
          new Set([
            ...filteredCandidateBottleIds,
            duplicateBottleCandidate.bottleId,
          ]),
        ),
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server blocked bottle creation because the proposed bottle draft duplicates an existing local bottle candidate.",
        ),
      });
    }

    if (
      !hasReferenceAnchoredSparseCreateProposal({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        candidates: artifacts.candidates,
        proposedBottle: proposedBottleDraft,
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
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope:
          decision.identityScope === "exact_cask" ||
          hasExactCaskSignals({
            reference,
            proposedBottle: normalizedDrafts.proposedBottle,
            extractedIdentity: artifacts.extractedIdentity,
            observation,
          })
            ? "exact_cask"
            : decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: proposedBottleDraft,
        hasReleaseIdentity: false,
        observation,
      }),
      observation,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: proposedBottleDraft,
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

    const parentCandidate = getCreateReleaseParentCandidate({
      decision,
      artifacts,
    });
    const parentReleaseTraitConflicts = parentCandidate
      ? getParentReleaseTraitConflicts({
          parentCandidate,
          release: normalizedDrafts.proposedRelease,
        })
      : [];
    if (parentReleaseTraitConflicts.length > 0) {
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
          `Server downgraded create_release because the proposed release conflicts with bottle-level parent traits (${parentReleaseTraitConflicts.join(
            "; ",
          )}); the classifier must use repair_parent_and_create_release when parent repair is required.`,
        ),
      });
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

  if (decision.action === "repair_parent_and_create_release") {
    if (decision.parentBottleId === null) {
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
          "Server downgraded repair_parent_and_create_release because no parent bottle id was returned.",
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
          "Server downgraded repair_parent_and_create_release because no parent repair draft was returned.",
        ),
      });
    }

    const sanitizedBottleDraft = sanitizeProposedBottleDraft(
      decision.proposedBottle,
      resolvedEntitiesById,
    );
    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: "bottle_and_release",
      proposedBottle: sanitizedBottleDraft,
      proposedRelease: decision.proposedRelease ?? null,
    });

    if (!normalizedDrafts.proposedBottle || !normalizedDrafts.proposedRelease) {
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
          "Server downgraded repair_parent_and_create_release because the parent repair or release draft could not be normalized.",
        ),
      });
    }

    const parentCandidate = getCreateReleaseParentCandidate({
      decision,
      artifacts,
    });
    const parentReleaseTraitConflicts = parentCandidate
      ? getParentReleaseTraitConflicts({
          parentCandidate,
          release: normalizedDrafts.proposedRelease,
        })
      : [];
    if (
      parentCandidate &&
      parentReleaseTraitConflicts.length === 0 &&
      !proposedBottleNeedsMaterialTargetRepair({
        target: parentCandidate,
        proposedBottle: normalizedDrafts.proposedBottle,
        extractedIdentity: artifacts.extractedIdentity,
      }) &&
      !proposedBottleRemovesReleaseTraits({
        target: parentCandidate,
        proposedBottle: normalizedDrafts.proposedBottle,
      })
    ) {
      return {
        action: "create_release",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server normalized parent repair to create_release because the selected parent is already a clean reusable parent for the proposed release.",
        ),
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

    return {
      action: "repair_parent_and_create_release",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: "product",
      observation,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId,
      proposedBottle: normalizedDrafts.proposedBottle,
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

    const normalizedAgentBottleDraft = sanitizeProposedBottleDraft(
      decision.proposedBottle,
      resolvedEntitiesById,
    );
    const normalizedAgentReleaseDraft = decision.proposedRelease ?? null;
    const sanitizedBottleDraft = normalizeSmwsExactCaskProposedBottleDraft({
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: normalizedAgentReleaseDraft
        ? normalizedAgentBottleDraft
        : restoreSparseAgeOnlyBottleName({
            reference,
            extractedIdentity: artifacts.extractedIdentity,
            proposedBottle: normalizedAgentBottleDraft,
          }),
      reference,
    });
    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: "bottle_and_release",
      proposedBottle: sanitizedBottleDraft,
      proposedRelease: normalizedAgentReleaseDraft,
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

    let proposedBottleDraft = normalizedDrafts.proposedBottle;
    let proposedReleaseDraft = normalizedDrafts.proposedRelease;
    let displayIdentityMissingTraits =
      (decision.identityScope ?? "product") === "exact_cask"
        ? []
        : getCreateBottleDisplayIdentityMissingTraits({
            reference,
            extractedIdentity: artifacts.extractedIdentity,
            artifacts,
            proposedBottle: proposedBottleDraft,
          });

    if (shouldRestoreMissingBottleAgeStatement(displayIdentityMissingTraits)) {
      const ageRestoredBottleDraft = restoreSparseAgeOnlyBottleName({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: proposedBottleDraft,
        forceAgeStatement: true,
      });
      const ageRestoredDrafts = normalizeBottleCreationDrafts({
        creationTarget: "bottle_and_release",
        proposedBottle: ageRestoredBottleDraft,
        proposedRelease: proposedReleaseDraft,
      });

      proposedBottleDraft =
        ageRestoredDrafts.proposedBottle ?? proposedBottleDraft;
      proposedReleaseDraft = ageRestoredDrafts.proposedRelease;
      displayIdentityMissingTraits =
        (decision.identityScope ?? "product") === "exact_cask"
          ? []
          : getCreateBottleDisplayIdentityMissingTraits({
              reference,
              extractedIdentity: artifacts.extractedIdentity,
              artifacts,
              proposedBottle: proposedBottleDraft,
            });
    }

    if (!proposedReleaseDraft) {
      if (displayIdentityMissingTraits.length > 0) {
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
            `Server downgraded bottle-and-release creation because the normalized bottle display name omits bottle-level traits (${displayIdentityMissingTraits.join(
              "; ",
            )}) that the source markets and the agent put on the bottle; choose a release action or include those traits in proposedBottle.name.`,
          ),
        });
      }

      return {
        action: "create_bottle",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle-and-release creation to bottle creation because no reusable release identity remained after normalization.",
        ),
        candidateBottleIds: filteredCandidateBottleIds,
        identityScope: inferBottleIdentityScope({
          requestedIdentityScope: decision.identityScope,
          reference,
          target: null,
          extractedIdentity: artifacts.extractedIdentity,
          proposedBottle: proposedBottleDraft,
          hasReleaseIdentity: false,
          observation,
        }),
        observation,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: proposedBottleDraft,
        proposedRelease: null,
      };
    }

    if (displayIdentityMissingTraits.length > 0) {
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
          `Server downgraded bottle-and-release creation because the proposed bottle display name omits bottle-level traits (${displayIdentityMissingTraits.join(
            "; ",
          )}) that the source markets and the agent put on the bottle; choose a release action or include those traits in proposedBottle.name.`,
        ),
      });
    }

    if (
      !hasReferenceAnchoredSparseCreateProposal({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        candidates: artifacts.candidates,
        proposedBottle: proposedBottleDraft,
        proposedRelease: proposedReleaseDraft,
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

    const exactCaskIdentityScope = inferBottleIdentityScope({
      requestedIdentityScope: decision.identityScope,
      reference,
      target: null,
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: proposedBottleDraft,
      hasReleaseIdentity: false,
      observation,
    });

    if (exactCaskIdentityScope === "exact_cask") {
      const exactCaskBottleDraft = normalizeBottleCreationDrafts({
        creationTarget: "bottle",
        proposedBottle: mergeReleaseIdentityIntoBottleDraft({
          proposedBottle: proposedBottleDraft,
          proposedRelease: proposedReleaseDraft,
        }),
        proposedRelease: null,
      }).proposedBottle;
      const proposedBottle = exactCaskBottleDraft ?? proposedBottleDraft;

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
        proposedBottle,
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
      proposedBottle: proposedBottleDraft,
      proposedRelease: proposedReleaseDraft,
    };
  }

  if (decision.action === "repair_bottle") {
    if (decision.matchedBottleId === null) {
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
          "Server downgraded repair_bottle because no matched bottle id was returned.",
        ),
      });
    }

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
          "Server downgraded repair_bottle because no proposed bottle repair draft was returned.",
        ),
      });
    }

    const matchedBottleId = decision.matchedBottleId;
    if (!candidateBottleIds.has(matchedBottleId)) {
      throw new BottleClassificationError(
        `Classifier returned unknown repair bottle id (${matchedBottleId}).`,
        artifacts,
      );
    }

    const target =
      artifacts.candidates.find(
        (candidate) =>
          candidate.bottleId === matchedBottleId &&
          (candidate.releaseId === null || candidate.kind === "bottle"),
      ) ?? null;
    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: "bottle",
      proposedBottle: sanitizeProposedBottleDraft(
        decision.proposedBottle,
        resolvedEntitiesById,
      ),
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
          "Server downgraded repair_bottle because the proposed bottle repair draft could not be normalized.",
        ),
      });
    }

    if (
      target &&
      candidateMatchesProposedBottleDraftIdentity({
        target,
        proposedBottle: normalizedDrafts.proposedBottle,
      }) &&
      !proposedBottleNeedsMaterialTargetRepair({
        target,
        proposedBottle: normalizedDrafts.proposedBottle,
        extractedIdentity: artifacts.extractedIdentity,
      })
    ) {
      return {
        action: "match",
        confidence: normalizedConfidence,
        rationale: appendRationale(
          decision.rationale,
          "Server normalized repair_bottle to a match because the proposed repair only restates the matched bottle identity or a legacy generic category.",
        ),
        candidateBottleIds: filteredCandidateBottleIds,
        identityScope: inferBottleIdentityScope({
          requestedIdentityScope: decision.identityScope,
          reference,
          target,
          extractedIdentity: artifacts.extractedIdentity,
          proposedBottle: null,
          hasReleaseIdentity: false,
          observation,
        }),
        observation,
        matchedBottleId,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      };
    }

    return {
      action: "repair_bottle",
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: normalizedDrafts.proposedBottle,
        hasReleaseIdentity: false,
        observation,
      }),
      observation,
      matchedBottleId,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: normalizedDrafts.proposedBottle,
      proposedRelease: null,
    };
  }

  return createNoMatchDecision({
    decision: {
      confidence: normalizedConfidence,
      rationale: decision.rationale,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: null,
        hasReleaseIdentity: false,
        observation,
      }),
      identityBasis: decision.identityBasis,
      confidenceBasis: decision.confidenceBasis,
    },
    candidateBottleIds: filteredCandidateBottleIds,
    observation,
    rationale: decision.rationale,
  });
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
  const normalizedName = normalizeString(referenceName).toLowerCase();
  if (!extractedIdentity) {
    if (
      NON_WHISKY_KEYWORDS.test(normalizedName) &&
      !WHISKY_KEYWORDS.test(normalizedName)
    ) {
      return "Reference is clearly a non-whisky category match and extraction found no whisky identity.";
    }

    if (GIFT_SET_PACKAGING_KEYWORDS.test(normalizedName)) {
      const identityTokens = getComparableNameTokens(normalizedName).filter(
        (token) =>
          !GIFT_SET_PACKAGING_TOKENS.has(token) && !/^\d+$/.test(token),
      );
      if (identityTokens.length === 0) {
        return "Reference is packaging-only gift-set text and extraction found no whisky identity.";
      }
    }
  }

  if (
    MULTI_ITEM_REFERENCE_PATTERNS.some((pattern) =>
      pattern.test(normalizedName),
    )
  ) {
    return "Reference is a bundle or multi-bottle listing, not a single bottle listing.";
  }

  if (
    NON_STANDARD_CONDITION_REFERENCE_PATTERNS.some((pattern) =>
      pattern.test(normalizedName),
    )
  ) {
    return "Reference describes a damaged or non-standard sale-condition bottle, not a standard bottle listing.";
  }

  return null;
}

export function finalizeBottleReferenceClassification({
  reference,
  decision,
  artifacts,
  options = {},
}: {
  reference: BottleReference;
  decision: BottleClassifierAgentDecisionInput;
  artifacts: BottleClassificationArtifacts;
  options?: {
    enforceCreateWebEvidence?: boolean;
  };
}): BottleClassificationDecision {
  const enforceCreateWebEvidence = options.enforceCreateWebEvidence ?? true;
  const parsedDecision = BottleClassifierAgentDecisionSchema.parse(
    normalizePotentialProofLikeDecision(decision),
  );
  const sanitizedDecision = sanitizeClassifierDecision({
    reference,
    decision: parsedDecision,
    artifacts,
  });
  const unsupportedStyleCategoryAdjustedDecision =
    maybeRemoveUnsupportedStyleBottleCategory({
      reference,
      decision: sanitizedDecision,
      artifacts,
    }) ?? sanitizedDecision;
  const unsupportedStyleNameAdjustedDecision =
    maybeRestoreUnsupportedStyleBottleName({
      reference,
      decision: unsupportedStyleCategoryAdjustedDecision,
      artifacts,
    }) ?? unsupportedStyleCategoryAdjustedDecision;
  const smwsCodeAdjustedDecision =
    maybeResolveSmwsExactCaskCodeDecision({
      reference,
      decision: unsupportedStyleNameAdjustedDecision,
      artifacts,
    }) ?? unsupportedStyleNameAdjustedDecision;
  const exactCaskAdjustedDecision =
    maybeResolveExactCaskCreateToExistingMatch({
      decision: smwsCodeAdjustedDecision,
      artifacts,
    }) ?? smwsCodeAdjustedDecision;
  const agentBasisAdjustedDecision = {
    ...exactCaskAdjustedDecision,
    identityBasis:
      exactCaskAdjustedDecision.identityBasis ?? parsedDecision.identityBasis,
    confidenceBasis:
      exactCaskAdjustedDecision.confidenceBasis ??
      parsedDecision.confidenceBasis,
  };
  const evidenceAdjustedDecision = enforceCreateWebEvidence
    ? capUnverifiedCreationAutomation({
        reference,
        decision: agentBasisAdjustedDecision,
        artifacts,
      })
    : agentBasisAdjustedDecision;
  const confidenceAdjustedDecision = capAutoVerificationWithUnresolvedRisks(
    evidenceAdjustedDecision,
  );
  const verificationEligibleConfidenceAdjustedDecision =
    capIneligibleExistingMatchAutoVerification({
      reference,
      decision: confidenceAdjustedDecision,
    });
  const reviewedDecision = rejectInvalidExistingMatch({
    reference,
    decision: verificationEligibleConfidenceAdjustedDecision,
    artifacts,
  });
  const finalDecision =
    reviewedDecision.proposedBottle && !reviewedDecision.proposedRelease
      ? {
          ...reviewedDecision,
          proposedBottle: restoreSparseAgeOnlyBottleName({
            reference,
            extractedIdentity: artifacts.extractedIdentity,
            proposedBottle: reviewedDecision.proposedBottle,
          }),
        }
      : reviewedDecision;

  return BottleClassificationDecisionSchema.parse({
    ...finalDecision,
    identityBasis: finalDecision.identityBasis ?? parsedDecision.identityBasis,
    confidenceBasis:
      finalDecision.confidenceBasis ?? parsedDecision.confidenceBasis,
  });
}
