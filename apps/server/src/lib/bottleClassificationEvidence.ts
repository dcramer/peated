import { normalizeString } from "@peated/server/lib/normalize";
import type {
  BottleCandidateSchema,
  BottleEvidenceCheckSchema,
  BottleReferenceIdentitySchema,
  BottleSearchEvidenceSchema,
  ProposedBottleSchema,
} from "@peated/server/schemas";
import type { z } from "zod";

// This module centralizes bottle-identity evidence evaluation that is shared by
// the generic bottle classifier and downstream consumers such as price-match
// automation. Keeping this here avoids letting feature-specific policy forks
// drift on what counts as supportive off-source evidence or a hard identity
// conflict.

type BottleCandidate = z.infer<typeof BottleCandidateSchema>;
type BottleExtractedDetails = z.infer<typeof BottleReferenceIdentitySchema>;
type BottleSearchEvidence = z.infer<typeof BottleSearchEvidenceSchema>;
type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
type EvidenceCheck = z.infer<typeof BottleEvidenceCheckSchema>;
type MatchAttribute = EvidenceCheck["attribute"];
type SourceTier = EvidenceCheck["matchedSourceTiers"][number];

const AUTHORITATIVE_SOURCE_TIERS = new Set<SourceTier>(["official", "critic"]);
const CRITIC_DOMAINS = [
  "breakingbourbon.com",
  "distiller.com",
  "paste.com",
  "rarebird101.com",
  "thewhiskeywash.com",
  "whiskyadvocate.com",
  "whiskyfun.com",
  "whiskynotes.be",
];
const RETAILER_DOMAINS = [
  "astorwines.com",
  "binnys.com",
  "healthyspirits.com",
  "klwines.com",
  "masterofmalt.com",
  "reservebar.com",
  "seelbachs.com",
  "sharedpour.com",
  "specsonline.com",
  "thewhiskyexchange.com",
  "totalwine.com",
  "woodencork.com",
];

function normalizeComparableText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return normalizeString(value).toLowerCase().replace(/_/g, " ").trim();
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

function normalizeComparablePhrase(value: string | null | undefined): string {
  return normalizeComparableText(value)
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function buildProducerIdentityPhrases({
  proposedBottle,
  extractedLabel,
  targetCandidate,
}: {
  proposedBottle: ProposedBottle | null;
  extractedLabel: BottleExtractedDetails | null;
  targetCandidate?: BottleCandidate | null;
}): Set<string> {
  return new Set(
    [
      proposedBottle?.brand.name,
      proposedBottle?.bottler?.name,
      ...(proposedBottle?.distillers.map((distiller) => distiller.name) ?? []),
      extractedLabel?.brand,
      extractedLabel?.bottler,
      ...(extractedLabel?.distillery ?? []),
      targetCandidate?.brand,
      targetCandidate?.bottler,
      ...(targetCandidate?.distillery ?? []),
    ]
      .map((value) => normalizeComparablePhrase(value))
      .filter((value) => value.length >= 4),
  );
}

function listMatchesExpectedValue(
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

function getSearchResultText(
  evidence: BottleSearchEvidence,
  result: BottleSearchEvidence["results"][number],
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

function classifySourceTier({
  result,
  sourceUrl,
  producerPhrases,
}: {
  result: BottleSearchEvidence["results"][number];
  sourceUrl: string;
  producerPhrases: Set<string>;
}): SourceTier {
  const resultDomain = result.domain ?? getComparableDomain(result.url);
  const sourceDomain = getComparableDomain(sourceUrl);

  if (
    resultDomain &&
    sourceDomain &&
    domainMatches(resultDomain, sourceDomain)
  ) {
    return "origin_retailer";
  }

  if (
    resultDomain &&
    CRITIC_DOMAINS.some((domain) => domainMatches(resultDomain, domain))
  ) {
    return "critic";
  }

  if (
    resultDomain &&
    Array.from(producerPhrases).some((phrase) =>
      resultDomain.replace(/[^a-z0-9]+/g, "").includes(phrase),
    )
  ) {
    return "official";
  }

  if (
    resultDomain &&
    RETAILER_DOMAINS.some((domain) => domainMatches(resultDomain, domain))
  ) {
    return "retailer";
  }

  return "unknown";
}

function getAbvSupportLevel(
  text: string,
  expectedValue: number,
): "none" | "close" | "exact" {
  const exactPattern = new RegExp(
    `\\b${escapeRegExp(expectedValue.toFixed(1))}%?(?:\\s*abv)?\\b|\\b${escapeRegExp(
      `${Math.round(expectedValue)}`,
    )}%\\s*abv\\b`,
    "i",
  );

  if (exactPattern.test(text)) {
    return "exact";
  }

  const match = text.match(/(\d{1,2}(?:\.\d)?)\s*%?\s*abv/i);
  if (!match) {
    return "none";
  }

  const value = Number(match[1]);
  if (Number.isNaN(value)) {
    return "none";
  }

  return Math.abs(value - expectedValue) <= 0.3 ? "close" : "none";
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

function attributeMatchesText(
  attribute: MatchAttribute,
  expectedValue: string,
  text: string,
): boolean {
  const normalizedText = normalizeComparableText(text);
  if (!normalizedText) {
    return false;
  }

  switch (attribute) {
    case "abv":
      return (
        getAbvSupportLevel(normalizedText, Number(expectedValue)) !== "none"
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

  if (label?.category && target.category === label.category) {
    addCheckIfPresent(checks, "category", label.category, false);
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

  if (label?.cask_type && textsOverlap(target.caskType, label.cask_type)) {
    addCheckIfPresent(checks, "caskType", label.cask_type, false);
  }

  if (label?.cask_size && textsOverlap(target.caskSize, label.cask_size)) {
    addCheckIfPresent(checks, "caskSize", label.cask_size, false);
  }

  if (label?.cask_fill && textsOverlap(target.caskFill, label.cask_fill)) {
    addCheckIfPresent(checks, "caskFill", label.cask_fill, false);
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

  if (extractedLabel?.category === null && target.category) {
    addCheckIfPresent(checks, "category", target.category, true);
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

  if (!extractedLabel?.cask_type && target.caskType) {
    addCheckIfPresent(checks, "caskType", target.caskType, true);
    differentiatingAttributes.add("caskType");
  }

  if (extractedLabel?.cask_size === null && target.caskSize) {
    addCheckIfPresent(checks, "caskSize", target.caskSize, true);
    differentiatingAttributes.add("caskSize");
  }

  if (extractedLabel?.cask_fill === null && target.caskFill) {
    addCheckIfPresent(checks, "caskFill", target.caskFill, true);
    differentiatingAttributes.add("caskFill");
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
  proposedBottle,
  extractedLabel,
  targetCandidate,
}: {
  checks: EvidenceCheck[];
  searchEvidence: BottleSearchEvidence[];
  sourceUrl: string;
  proposedBottle: ProposedBottle | null;
  extractedLabel: BottleExtractedDetails | null;
  targetCandidate?: BottleCandidate | null;
}): EvidenceCheck[] {
  if (!checks.length || !searchEvidence.length) {
    return checks;
  }

  const producerPhrases = buildProducerIdentityPhrases({
    proposedBottle,
    extractedLabel,
    targetCandidate,
  });

  return checks.map((check) => {
    const matchedSourceTiers = new Set<SourceTier>();
    const matchedSourceUrls = new Set<string>();

    for (const evidence of searchEvidence) {
      for (const result of evidence.results) {
        const text = getSearchResultText(evidence, result);
        if (!attributeMatchesText(check.attribute, check.expectedValue, text)) {
          continue;
        }

        const sourceTier = classifySourceTier({
          result,
          sourceUrl,
          producerPhrases,
        });
        matchedSourceTiers.add(sourceTier);
        matchedSourceUrls.add(result.url);
      }
    }

    const tiers = Array.from(matchedSourceTiers);
    const validated = tiers.some((tier) =>
      AUTHORITATIVE_SOURCE_TIERS.has(tier),
    );
    const weaklySupported =
      !validated &&
      tiers.some((tier) =>
        ["retailer", "origin_retailer", "unknown"].includes(tier),
      );

    return {
      ...check,
      validated,
      weaklySupported,
      matchedSourceTiers: tiers,
      matchedSourceUrls: Array.from(matchedSourceUrls),
    };
  });
}

function hasOffRetailerSupport(check: EvidenceCheck): boolean {
  return (
    check.validated ||
    (check.weaklySupported &&
      !check.matchedSourceTiers.includes("origin_retailer"))
  );
}

export function hasSupportiveWebEvidenceForExistingMatch({
  sourceUrl,
  target,
  extractedLabel,
  searchEvidence,
}: {
  sourceUrl: string;
  target: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null;
  searchEvidence: BottleSearchEvidence[];
}): boolean {
  const { checks, differentiatingAttributes } = buildExistingMatchSupportChecks(
    {
      target,
      extractedLabel,
    },
  );

  if (!checks.length || !searchEvidence.length) {
    return false;
  }

  const evaluatedChecks = evaluateSearchEvidenceChecks({
    checks,
    searchEvidence,
    sourceUrl,
    proposedBottle: null,
    extractedLabel,
    targetCandidate: target,
  });
  const supportedChecks = evaluatedChecks.filter(hasOffRetailerSupport);

  if (!supportedChecks.length) {
    return false;
  }

  const hasBaseIdentitySupport = supportedChecks.some((check) =>
    ["brand", "name", "series", "distillery", "bottler"].includes(
      check.attribute,
    ),
  );

  if (!hasBaseIdentitySupport) {
    return false;
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
    return false;
  }

  if (!differentiatingAttributes.length) {
    return true;
  }

  return supportedChecks.some((check) =>
    differentiatingAttributes.includes(check.attribute),
  );
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
    extractedLabel.category &&
    target.category &&
    target.category !== extractedLabel.category
  ) {
    conflicts.push("candidate category conflicts with extracted label");
  }

  if (
    extractedLabel.stated_age !== null &&
    target.statedAge !== null &&
    target.statedAge !== extractedLabel.stated_age
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
    extractedLabel.cask_type &&
    target.caskType &&
    !textsOverlap(target.caskType, extractedLabel.cask_type)
  ) {
    conflicts.push("candidate cask type conflicts with extracted label");
  }

  if (
    extractedLabel.cask_size &&
    target.caskSize &&
    !textsOverlap(target.caskSize, extractedLabel.cask_size)
  ) {
    conflicts.push("candidate cask size conflicts with extracted label");
  }

  if (
    extractedLabel.cask_fill &&
    target.caskFill &&
    !textsOverlap(target.caskFill, extractedLabel.cask_fill)
  ) {
    conflicts.push("candidate cask fill conflicts with extracted label");
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
