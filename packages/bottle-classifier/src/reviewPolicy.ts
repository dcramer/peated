import { normalizePotentialProofLikeDecision } from "./abv";
import {
  exactEditionMarkersMatch,
  extractedIdentityLooksLikePlainAgeStatementReference,
  getExistingMatchIdentityConflicts,
} from "./bottleClassificationEvidence";
import { normalizeProposedBottleDraft } from "./bottleCreationDrafts";
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
  bottleNameDuplicatesBrand,
  normalizeBottle,
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "./normalize";
import { normalizeObservation } from "./observation";
import {
  candidateLooksSmws,
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
}: {
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
}): string[] {
  return Array.from(
    new Set([
      ...getStrictComparableNameTokens(proposedBottle.brand.name),
      ...getStrictComparableNameTokens(proposedBottle.series?.name),
      ...getStrictComparableNameTokens(proposedBottle.name),
      ...getStrictComparableNameTokens(
        proposedBottle.releaseYear != null
          ? String(proposedBottle.releaseYear)
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
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  candidates: BottleCandidate[];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
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
  const proposedTokens = getReferenceAnchoredCreateTokens({ proposedBottle });
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
    (comparableTextMarketsStatedAge(reference.name, statedAge) ||
      extractedIdentity?.stated_age === statedAge) &&
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

  if (
    statedAge !== null &&
    statedAge !== undefined &&
    (comparableTextMarketsStatedAge(reference.name, statedAge) ||
      extractedIdentity?.stated_age === statedAge) &&
    !comparableTextMarketsStatedAge(name, statedAge)
  ) {
    name = `${name} ${statedAge}-year-old`;
  }

  return name === proposedBottle.name
    ? proposedBottle
    : {
        ...proposedBottle,
        name: normalizeString(name),
      };
}

function stripStructuredExactTraitsFromStableBottleName(
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>,
): NonNullable<BottleClassificationDecision["proposedBottle"]> | null {
  let name = proposedBottle.name;
  const exactPhrases = [
    proposedBottle.edition,
    proposedBottle.vintageYear != null
      ? `${proposedBottle.vintageYear} Vintage`
      : null,
    proposedBottle.vintageYear != null
      ? `Vintage ${proposedBottle.vintageYear}`
      : null,
    proposedBottle.releaseYear != null
      ? `${proposedBottle.releaseYear} Release`
      : null,
    proposedBottle.releaseYear != null
      ? `Release ${proposedBottle.releaseYear}`
      : null,
    proposedBottle.releaseYear != null
      ? `${proposedBottle.releaseYear} Bottling`
      : null,
    proposedBottle.releaseYear != null
      ? `Bottled ${proposedBottle.releaseYear}`
      : null,
    proposedBottle.vintageYear != null
      ? String(proposedBottle.vintageYear)
      : null,
    proposedBottle.releaseYear != null
      ? String(proposedBottle.releaseYear)
      : null,
  ];

  for (const phrase of exactPhrases) {
    const normalizedPhrase = normalizeString(phrase ?? "");
    if (!normalizedPhrase) {
      continue;
    }

    name = name
      .replace(
        new RegExp(
          `(^|[^a-z0-9])${escapeRegExp(normalizedPhrase)}(?=$|[^a-z0-9])`,
          "gi",
        ),
        "$1",
      )
      .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, " ");
  }

  name = normalizeString(name)
    .replace(/([,;:/|–—-])(?:\s*[,;:/|–—-])+/g, "$1")
    .replace(/\s+([,;:])/g, "$1")
    .replace(/^[\s,;:/|\-–—]+|[\s,;:/|\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !name ||
    bottleNameDuplicatesBrand(name, proposedBottle.brand.name) ||
    normalizeComparableText(name) ===
      normalizeComparableText(proposedBottle.brand.name)
  ) {
    return null;
  }

  return name === proposedBottle.name
    ? proposedBottle
    : { ...proposedBottle, name };
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

function getCreateBottleDisplayIdentityMissingTraits({
  reference,
  extractedIdentity,
  proposedBottle,
}: {
  reference: BottleReference;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
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
    !proposedBottleNameMarketsStatedAge({
      proposedBottle,
      statedAge,
    })
  ) {
    missingTraits.push("statedAge");
  }

  return missingTraits;
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
      (candidate) => candidate.bottleId === decision.matchedBottleId,
    ) ?? null
  );
}

function maybeRejectExactCaskCreateDuplicate({
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
          candidateStructurallyMatchesExactCaskDraft({
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

  return createNoMatchDecision({
    decision,
    candidateBottleIds: Array.from(
      new Set([...decision.candidateBottleIds, existingTarget.bottleId]),
    ),
    observation: decision.observation,
    identityScope: "exact_cask",
    rationale: appendRationale(
      decision.rationale,
      "Server downgraded exact-cask creation because an existing local Bottle already has the exact code anchor; the reviewed action must select that Bottle explicitly.",
    ),
  });
}

function getBottleTargetNameCandidates(target: BottleCandidate): string[] {
  return Array.from(
    new Set(
      [target.alias, target.fullName]
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

function candidateStructurallyMatchesExactCaskDraft({
  target,
  proposedBottle,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
}): boolean {
  if (
    normalizeComparableText(target.brand) !==
    normalizeComparableText(proposedBottle.brand.name)
  ) {
    return false;
  }

  const targetNames = getBottleTargetNameCandidates(target).map((name) =>
    normalizeComparableText(name),
  );
  const proposedNames = getProposedBottleNameCandidates(proposedBottle).map(
    (name) => normalizeComparableText(name),
  );
  if (!proposedNames.some((name) => targetNames.includes(name))) {
    return false;
  }

  return (
    normalizeComparableText(target.series) ===
    normalizeComparableText(proposedBottle.series?.name)
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
    !exactEditionMarkersMatch(target.edition, proposedBottle.edition)
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

  if (
    proposedBottle.caskType !== null &&
    target.caskType !== proposedBottle.caskType
  ) {
    return true;
  }

  if (
    proposedBottle.caskSize !== null &&
    target.caskSize !== proposedBottle.caskSize
  ) {
    return true;
  }

  if (
    proposedBottle.caskFill !== null &&
    target.caskFill !== proposedBottle.caskFill
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
      caskType: target.caskType === null ? null : proposedBottle.caskType,
      caskSize: target.caskSize === null ? null : proposedBottle.caskSize,
      caskFill: target.caskFill === null ? null : proposedBottle.caskFill,
    },
    extractedIdentity,
  });
}

function findConflictingDuplicateCreateBottleCandidate({
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

function createNoMatchDecision({
  decision,
  candidateBottleIds,
  rationale,
  observation,
  identityScope,
}: {
  decision: Pick<BottleClassifierAgentDecision, "rationale" | "identityScope"> &
    Partial<Pick<BottleClassifierAgentDecision, "aliasScope">> &
    Partial<
      Pick<BottleClassifierAgentDecision, "identityBasis" | "confidenceBasis">
    >;
  candidateBottleIds: number[];
  rationale: string | null;
  observation: BottleObservation | null;
  identityScope?: BottleClassificationDecision["identityScope"];
}): BottleClassificationDecision {
  return BottleClassificationDecisionSchema.parse({
    action: "no_match",
    rationale,
    candidateBottleIds,
    identityScope: identityScope ?? decision.identityScope ?? "product",
    aliasScope: decision.aliasScope ?? "none",
    observation,
    identityBasis: decision.identityBasis ?? null,
    confidenceBasis: decision.confidenceBasis ?? null,
    matchedBottleId: null,
    proposedBottle: null,
  });
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
  const smwsCode = getSmwsCodeAnchor({ reference, decision, artifacts });
  const materialIdentityConflicts =
    smwsCode &&
    candidateLooksSmws(target) &&
    candidateHasExactCaskCodeAnchor(target, smwsCode)
      ? identityConflicts.filter((field) => field !== "brand")
      : identityConflicts;

  if (!materialIdentityConflicts.length) {
    return decision;
  }

  const downgradedRationale = appendRationale(
    decision.rationale,
    `Server downgraded the existing-match recommendation because the candidate conflicts with extracted reference details (${materialIdentityConflicts.join(
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
  const resolvedEntitiesById = new Map(
    artifacts.resolvedEntities.map((entity) => [entity.entityId, entity]),
  );
  const filteredCandidateBottleIds = decision.candidateBottleIds.filter((id) =>
    candidateBottleIds.has(id),
  );
  const observation = normalizeObservation(decision.observation);

  if (decision.action === "match") {
    if (decision.matchedBottleId === null) {
      return createNoMatchDecision({
        decision: {
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
    if (!candidateBottleIds.has(matchedBottleId)) {
      throw new BottleClassificationError(
        `Classifier returned unknown matched bottle id (${matchedBottleId}).`,
        artifacts,
      );
    }

    const target =
      artifacts.candidates.find(
        (candidate) => candidate.bottleId === matchedBottleId,
      ) ?? null;

    return {
      action: "match",
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: null,
        observation,
      }),
      observation,
      matchedBottleId,
      proposedBottle: null,
    };
  }

  if (decision.action === "create_bottle") {
    if (!decision.proposedBottle) {
      return createNoMatchDecision({
        decision: {
          ...decision,
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
    let proposedBottleDraft =
      normalizeProposedBottleDraft(sanitizedBottleDraft);

    if (
      bottleNameDuplicatesBrand(
        proposedBottleDraft.name,
        proposedBottleDraft.brand.name,
      )
    ) {
      return createNoMatchDecision({
        decision,
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_bottle because the proposed bottle name duplicates the brand instead of naming an expression.",
        ),
      });
    }

    const stableBottleDraft =
      stripStructuredExactTraitsFromStableBottleName(proposedBottleDraft);
    if (!stableBottleDraft) {
      return createNoMatchDecision({
        decision,
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_bottle because removing structured exact traits leaves no stable expression distinct from the brand.",
        ),
      });
    }
    proposedBottleDraft = stableBottleDraft;
    const smwsAnchorDecision: BottleClassificationDecision = {
      ...decision,
      action: "create_bottle",
      identityScope: decision.identityScope ?? "product",
      aliasScope: decision.aliasScope ?? undefined,
      matchedBottleId: null,
      proposedBottle: proposedBottleDraft,
    };
    const hasSmwsCodeAnchor = Boolean(
      getSmwsCodeAnchor({
        reference,
        decision: smwsAnchorDecision,
        artifacts,
      }),
    );

    if (
      (decision.identityScope ?? "product") === "exact_cask" &&
      !hasSmwsCodeAnchor
    ) {
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
        proposedBottleDraft = normalizeProposedBottleDraft(
          ageRestoredBottleDraft,
        );
      }
    }

    if ((decision.identityScope ?? "product") !== "exact_cask") {
      const displayIdentityMissingTraits =
        getCreateBottleDisplayIdentityMissingTraits({
          reference,
          extractedIdentity: artifacts.extractedIdentity,
          proposedBottle: proposedBottleDraft,
        });
      if (displayIdentityMissingTraits.length > 0) {
        return createNoMatchDecision({
          decision: {
            ...decision,
          },
          candidateBottleIds: filteredCandidateBottleIds,
          observation,
          identityScope: "product",
          rationale: appendRationale(
            decision.rationale,
            `Server downgraded create_bottle because the proposed bottle display name omits bottle-level traits (${displayIdentityMissingTraits.join(
              "; ",
            )}) that the source markets; include those traits in proposedBottle.name.`,
          ),
        });
      }
    }

    const duplicateBottleCandidate =
      findConflictingDuplicateCreateBottleCandidate({
        reference,
        proposedBottle: proposedBottleDraft,
        artifacts,
        observation,
        requestedIdentityScope: decision.identityScope,
      });
    if (duplicateBottleCandidate) {
      return createNoMatchDecision({
        decision,
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
          "Server downgraded create_bottle because an exact existing Bottle candidate may already cover the proposed identity; the reviewed action must select that Bottle explicitly.",
        ),
      });
    }

    if (
      !hasReferenceAnchoredSparseCreateProposal({
        reference,
        extractedIdentity: artifacts.extractedIdentity,
        candidates: artifacts.candidates,
        proposedBottle: proposedBottleDraft,
      })
    ) {
      return createNoMatchDecision({
        decision: {
          ...decision,
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
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope:
          decision.identityScope === "exact_cask" ||
          hasExactCaskSignals({
            reference,
            proposedBottle: proposedBottleDraft,
            extractedIdentity: artifacts.extractedIdentity,
            observation,
          })
            ? "exact_cask"
            : decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: proposedBottleDraft,
        observation,
      }),
      observation,
      matchedBottleId: null,
      proposedBottle: proposedBottleDraft,
    };
  }

  if (decision.action === "repair_bottle") {
    if (decision.matchedBottleId === null) {
      return createNoMatchDecision({
        decision: {
          ...decision,
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
        (candidate) => candidate.bottleId === matchedBottleId,
      ) ?? null;
    const normalizedBottleDraft = normalizeProposedBottleDraft(
      sanitizeProposedBottleDraft(
        decision.proposedBottle,
        resolvedEntitiesById,
      ),
    );

    if (
      bottleNameDuplicatesBrand(
        normalizedBottleDraft.name,
        normalizedBottleDraft.brand.name,
      )
    ) {
      return createNoMatchDecision({
        decision,
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded bottle repair because the proposed bottle name duplicates the brand instead of naming an expression.",
        ),
      });
    }

    if (
      target &&
      candidateMatchesProposedBottleDraftIdentity({
        target,
        proposedBottle: normalizedBottleDraft,
      }) &&
      !proposedBottleNeedsMaterialTargetRepair({
        target,
        proposedBottle: normalizedBottleDraft,
        extractedIdentity: artifacts.extractedIdentity,
      })
    ) {
      return {
        action: "match",
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
          observation,
        }),
        observation,
        matchedBottleId,
        proposedBottle: null,
      };
    }

    return {
      action: "repair_bottle",
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: normalizedBottleDraft,
        observation,
      }),
      observation,
      matchedBottleId,
      proposedBottle: normalizedBottleDraft,
    };
  }

  return createNoMatchDecision({
    decision: {
      rationale: decision.rationale,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: null,
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
}: {
  reference: BottleReference;
  decision: BottleClassifierAgentDecisionInput;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  const parsedDecision: BottleClassifierAgentDecision =
    BottleClassifierAgentDecisionSchema.parse(
      normalizePotentialProofLikeDecision(decision),
    );
  const sanitizedDecision = sanitizeClassifierDecision({
    reference,
    decision: parsedDecision,
    artifacts,
  });
  const smwsCodeAdjustedDecision =
    maybeResolveSmwsExactCaskCodeDecision({
      reference,
      decision: sanitizedDecision,
      artifacts,
    }) ?? sanitizedDecision;
  const exactCaskAdjustedDecision =
    maybeRejectExactCaskCreateDuplicate({
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
  // The former numeric/band reconciliation caps (capUnverifiedCreationAutomation,
  // capAutoVerificationWithUnresolvedRisks, capIneligibleExistingMatchAutoVerification)
  // were retired with numeric confidence and the confidence band. Automated
  // consumers now derive review routing from structured evidence via
  // `deriveAutomationTier`, so review gating no longer lives in this pipeline.
  const reviewedDecision = rejectInvalidExistingMatch({
    reference,
    decision: agentBasisAdjustedDecision,
    artifacts,
  });
  const finalDecision = reviewedDecision.proposedBottle
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
    aliasScope: finalDecision.aliasScope ?? parsedDecision.aliasScope ?? "none",
    identityBasis: finalDecision.identityBasis ?? parsedDecision.identityBasis,
    confidenceBasis:
      finalDecision.confidenceBasis ?? parsedDecision.confidenceBasis,
  });
}
