import type {
  BottleCandidate,
  BottleExtractedDetails,
  BottleSearchEvidence,
  ProposedBottle,
} from "./classifierTypes";
import {
  AUTHORITATIVE_SOURCE_TIERS,
  buildProducerIdentityPhrases,
  classifySourceTier,
  containsComparablePhrase,
  escapeRegExp,
  getAbvSupportLevel,
  getComparableDomain,
  getSearchResultText,
  listMatchesExpectedValue,
  normalizeComparablePhrase,
  normalizeComparableText,
  textsOverlap,
} from "./identityEvidenceCore";
import { normalizeBottle } from "./normalize";

type MatchAttribute =
  | "brand"
  | "bottler"
  | "name"
  | "series"
  | "distillery"
  | "category"
  | "statedAge"
  | "edition"
  | "caskType"
  | "caskSize"
  | "caskFill"
  | "caskStrength"
  | "singleCask"
  | "abv"
  | "vintageYear"
  | "releaseYear";

type SourceTier =
  | "official"
  | "critic"
  | "retailer"
  | "origin_retailer"
  | "unknown";

type EvidenceCheck = {
  attribute: MatchAttribute;
  expectedValue: string;
  required: boolean;
  validated: boolean;
  weaklySupported: boolean;
  matchedSourceTiers: SourceTier[];
  matchedSourceUrls: string[];
};

const IGNORABLE_TITLE_EXTRA_TOKENS = new Set([
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
  "official",
  "oz",
  "scotch",
  "single",
  "spirit",
  "spirits",
  "straight",
  "the",
  "website",
  "whiskey",
  "whisky",
  "whiskies",
  "world",
  "year",
  "years",
  "yr",
  "yrs",
]);

function getComparableNameTokens(value: string | null | undefined): string[] {
  return normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0);
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

  return normalizeBottle({
    name,
    statedAge,
  })
    .name.toLowerCase()
    .match(new RegExp(`\\b${statedAge}-year-old\\b`, "i"))
    ? true
    : false;
}

export function hasDirtyParentStatedAgeConflict({
  targetCandidate,
  extractedLabel,
}: {
  targetCandidate: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null | undefined;
}): boolean {
  if (
    !extractedLabel ||
    extractedLabel.stated_age === null ||
    extractedLabel.stated_age === undefined ||
    targetCandidate.kind === "release" ||
    targetCandidate.releaseId !== null ||
    targetCandidate.statedAge === null ||
    targetCandidate.statedAge === extractedLabel.stated_age
  ) {
    return false;
  }

  return !getTargetNameVariants(targetCandidate).some((name) =>
    nameMarketsStatedAge({
      name,
      statedAge: targetCandidate.statedAge,
    }),
  );
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

    if (!IGNORABLE_TITLE_EXTRA_TOKENS.has(token)) {
      return false;
    }
  }

  return true;
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
): {
  matched: boolean;
  weaklySupported: boolean;
} {
  switch (attribute) {
    case "abv": {
      const supportLevel = getAbvSupportLevel(text, Number(expectedValue));
      return {
        matched: supportLevel === "exact",
        weaklySupported: supportLevel === "close",
      };
    }
    case "category":
      return {
        matched: getCategoryKeywords(expectedValue).some((keyword) =>
          containsComparablePhrase(text, keyword),
        ),
        weaklySupported: false,
      };
    case "distillery":
      return {
        matched: expectedValue
          .split("|")
          .some((value) => containsComparablePhrase(text, value)),
        weaklySupported: false,
      };
    case "caskStrength":
      return {
        matched:
          expectedValue === "true" &&
          /\bcask strength\b|\bbarrel strength\b|\bbarrel proof\b|\bfull proof\b|\bnatural strength\b/i.test(
            text,
          ),
        weaklySupported: false,
      };
    case "singleCask":
      return {
        matched:
          expectedValue === "true" &&
          /\bsingle cask\b|\bsingle barrel\b/i.test(text),
        weaklySupported: false,
      };
    default:
      return {
        matched: containsComparablePhrase(text, expectedValue),
        weaklySupported: false,
      };
  }
}

function buildEvidenceChecks({
  sourceUrl,
  searchEvidence,
  extractedLabel,
  proposedBottle,
  targetCandidate,
}: {
  sourceUrl: string;
  searchEvidence: BottleSearchEvidence[];
  extractedLabel: BottleExtractedDetails | null;
  proposedBottle: ProposedBottle | null;
  targetCandidate?: BottleCandidate | null;
}): EvidenceCheck[] {
  const producerPhrases = buildProducerIdentityPhrases({
    proposedBottle,
    extractedLabel,
    targetCandidate,
  });
  const checks: EvidenceCheck[] = [];

  const attributes: Array<{
    attribute: MatchAttribute;
    expectedValue: string | null;
    required?: boolean;
  }> = [
    {
      attribute: "brand",
      expectedValue:
        proposedBottle?.brand.name ??
        extractedLabel?.brand ??
        targetCandidate?.brand ??
        null,
      required: true,
    },
    {
      attribute: "name",
      expectedValue:
        proposedBottle?.name ??
        extractedLabel?.expression ??
        targetCandidate?.bottleFullName ??
        targetCandidate?.fullName ??
        null,
      required: true,
    },
    {
      attribute: "bottler",
      expectedValue:
        proposedBottle?.bottler?.name ??
        extractedLabel?.bottler ??
        targetCandidate?.bottler ??
        null,
    },
    {
      attribute: "series",
      expectedValue:
        proposedBottle?.series?.name ??
        extractedLabel?.series ??
        targetCandidate?.series ??
        null,
    },
    {
      attribute: "distillery",
      expectedValue: proposedBottle?.distillers.length
        ? proposedBottle.distillers.map((distiller) => distiller.name).join("|")
        : extractedLabel?.distillery?.length
          ? extractedLabel.distillery.join("|")
          : targetCandidate?.distillery.length
            ? targetCandidate.distillery.join("|")
            : null,
    },
    {
      attribute: "category",
      expectedValue:
        proposedBottle?.category ??
        extractedLabel?.category ??
        targetCandidate?.category ??
        null,
    },
  ];

  for (const entry of attributes) {
    if (!entry.expectedValue) {
      continue;
    }

    const check: EvidenceCheck = {
      attribute: entry.attribute,
      expectedValue: entry.expectedValue,
      required: entry.required ?? false,
      validated: false,
      weaklySupported: false,
      matchedSourceTiers: [],
      matchedSourceUrls: [],
    };

    for (const evidence of searchEvidence) {
      for (const result of evidence.results) {
        const text = normalizeComparableText(
          getSearchResultText(evidence, result),
        );
        const evaluation = attributeMatchesText(
          entry.attribute,
          normalizeComparableText(entry.expectedValue),
          text,
        );

        if (!evaluation.matched && !evaluation.weaklySupported) {
          continue;
        }

        const sourceTier = classifySourceTier({
          result,
          sourceUrl,
          producerPhrases,
        });

        if (evaluation.matched) {
          check.validated = true;
          check.matchedSourceUrls.push(result.url);
          check.matchedSourceTiers.push(sourceTier);
        } else {
          check.weaklySupported = true;
          check.matchedSourceUrls.push(result.url);
          check.matchedSourceTiers.push(sourceTier);
        }
      }
    }

    check.matchedSourceUrls = Array.from(new Set(check.matchedSourceUrls));
    check.matchedSourceTiers = Array.from(new Set(check.matchedSourceTiers));
    checks.push(check);
  }

  return checks;
}

export function hasSupportiveWebEvidenceForExistingMatch({
  sourceUrl,
  searchEvidence,
  extractedLabel,
  targetCandidate,
}: {
  sourceUrl: string;
  searchEvidence: BottleSearchEvidence[];
  extractedLabel: BottleExtractedDetails | null;
  targetCandidate: BottleCandidate | null;
}) {
  if (!targetCandidate) {
    return false;
  }

  const producerPhrases = buildProducerIdentityPhrases({
    proposedBottle: null,
    extractedLabel,
    targetCandidate,
  });
  const targetNameVariants = getTargetNameVariants(targetCandidate);

  return searchEvidence.some((evidence) =>
    evidence.results.some((result) => {
      const sourceTier = classifySourceTier({
        result,
        sourceUrl,
        producerPhrases,
      });

      if (!AUTHORITATIVE_SOURCE_TIERS.has(sourceTier)) {
        return false;
      }

      return targetNameVariants.some((variant) =>
        titleSupportsCandidateName(result.title, variant),
      );
    }),
  );
}

export function getExistingMatchIdentityConflicts({
  referenceName,
  targetCandidate,
  extractedLabel,
}: {
  referenceName: string;
  targetCandidate: BottleCandidate | null;
  extractedLabel: BottleExtractedDetails | null;
}) {
  if (!targetCandidate) {
    return [];
  }

  const conflicts: string[] = [];

  if (
    extractedLabel?.brand &&
    targetCandidate.brand &&
    !textsOverlap(extractedLabel.brand, targetCandidate.brand)
  ) {
    conflicts.push("brand");
  }

  if (
    extractedLabel?.bottler &&
    targetCandidate.bottler &&
    !textsOverlap(extractedLabel.bottler, targetCandidate.bottler)
  ) {
    conflicts.push("bottler");
  }

  if (
    extractedLabel?.series &&
    targetCandidate.series &&
    !textsOverlap(extractedLabel.series, targetCandidate.series)
  ) {
    conflicts.push("series");
  }

  if (
    extractedLabel?.category &&
    targetCandidate.category &&
    extractedLabel.category !== targetCandidate.category
  ) {
    conflicts.push("category");
  }

  if (
    extractedLabel?.distillery?.length &&
    targetCandidate.distillery.length &&
    !listMatchesExpectedValue(
      targetCandidate.distillery,
      extractedLabel.distillery,
    )
  ) {
    conflicts.push("distillery");
  }

  if (
    extractedLabel?.stated_age !== null &&
    extractedLabel?.stated_age !== undefined &&
    targetCandidate.statedAge !== null &&
    extractedLabel.stated_age !== targetCandidate.statedAge &&
    !hasDirtyParentStatedAgeConflict({
      targetCandidate,
      extractedLabel,
    })
  ) {
    conflicts.push("stated_age");
  }

  if (
    extractedLabel?.edition &&
    targetCandidate.edition &&
    !textsOverlap(extractedLabel.edition, targetCandidate.edition)
  ) {
    conflicts.push("edition");
  }

  if (
    extractedLabel?.expression &&
    targetCandidate.fullName &&
    !textsOverlap(extractedLabel.expression, targetCandidate.fullName) &&
    !textsOverlap(extractedLabel.expression, referenceName)
  ) {
    conflicts.push("expression");
  }

  return conflicts;
}
