import {
  getExistingMatchIdentityConflicts,
  hasSupportiveWebEvidenceForExistingMatch as hasSupportiveBottleEvidence,
} from "@peated/bottle-classifier/priceMatchingEvidence";
import type { StorePrice } from "@peated/server/db/schema";
import {
  containsComparablePhrase,
  escapeRegExp,
  listMatchesExpectedValue,
  normalizeComparableText,
  textsOverlap,
} from "@peated/server/lib/priceMatchingText";
import type { StorePriceMatchAutomationAssessmentSchema } from "@peated/server/schemas";
import {
  type BottleCandidateSchema,
  type BottleCreationTargetEnum,
  type BottleEvidenceCheckSchema,
  type BottleReferenceIdentitySchema,
  type BottleSearchEvidenceSchema,
  type ProposedBottleSchema,
  type ProposedReleaseSchema,
} from "@peated/server/schemas";
import type { z } from "zod";

type ExtractedBottleDetails = z.infer<typeof BottleReferenceIdentitySchema>;
type PriceMatchCandidate = z.infer<typeof BottleCandidateSchema>;
type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
type ProposedRelease = z.infer<typeof ProposedReleaseSchema>;
type SearchEvidence = z.infer<typeof BottleSearchEvidenceSchema>;
type EvidenceCheck = z.infer<typeof BottleEvidenceCheckSchema>;
type MatchAction = "match_existing" | "correction" | "create_new" | "no_match";
type MatchAttribute = EvidenceCheck["attribute"];
type SourceTier = EvidenceCheck["matchedSourceTiers"][number];
type MatchCreationTarget = z.infer<typeof BottleCreationTargetEnum>;

type MatchAutomationInput = {
  action: MatchAction;
  modelConfidence: number | null;
  price: Pick<StorePrice, "bottleId" | "name" | "url"> & {
    releaseId?: number | null;
  };
  suggestedBottleId: number | null;
  suggestedReleaseId?: number | null;
  candidateBottles: PriceMatchCandidate[];
  extractedLabel: ExtractedBottleDetails | null;
  proposedBottle: ProposedBottle | null;
  proposedRelease?: ProposedRelease | null;
  creationTarget?: MatchCreationTarget | null;
  searchEvidence: SearchEvidence[];
};

export function hasSupportiveWebEvidenceForExistingMatch({
  priceUrl,
  target,
  extractedLabel,
  searchEvidence,
}: {
  priceUrl: string;
  target: PriceMatchCandidate;
  extractedLabel: ExtractedBottleDetails | null;
  searchEvidence: SearchEvidence[];
}) {
  return hasSupportiveBottleEvidence({
    sourceUrl: priceUrl,
    target,
    extractedLabel,
    searchEvidence,
  });
}

export type StorePriceMatchAutomationAssessment = z.infer<
  typeof StorePriceMatchAutomationAssessmentSchema
>;

const VERIFIED_MATCH_CONFIDENCE_THRESHOLD = 80;
const HIGH_CONFIDENCE_EXACT_MATCH_MODEL_CONFIDENCE_THRESHOLD = 95;
const HIGH_CONFIDENCE_STRUCTURED_MATCH_MODEL_CONFIDENCE_THRESHOLD = 95;
const AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD = 90;
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
const WEB_VALIDATED_DIFFERENTIATORS = new Set<MatchAttribute>([
  "bottler",
  "series",
  "distillery",
  "statedAge",
  "edition",
  "caskType",
  "caskSize",
  "caskFill",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
]);
const HIGH_CONFIDENCE_STRUCTURED_MATCH_REQUIRED_ATTRIBUTES: MatchAttribute[] = [
  "brand",
  "name",
  "distillery",
  "category",
];
function clampScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getComparableDomain(url: string | null | undefined) {
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

function domainMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeComparablePhrase(value: string | null | undefined) {
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
  extractedLabel: ExtractedBottleDetails | null;
  targetCandidate?: PriceMatchCandidate | null;
}) {
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

function getSearchResultText(
  evidence: SearchEvidence,
  result: SearchEvidence["results"][number],
) {
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
  priceUrl,
  producerPhrases,
}: {
  result: SearchEvidence["results"][number];
  priceUrl: string;
  producerPhrases: Set<string>;
}): SourceTier {
  const resultDomain = result.domain ?? getComparableDomain(result.url);
  const originDomain = getComparableDomain(priceUrl);

  if (
    resultDomain &&
    originDomain &&
    domainMatches(resultDomain, originDomain)
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

function getCategoryKeywords(value: string) {
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
) {
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
) {
  return {
    attribute,
    expectedValue: String(expectedValue),
    required,
    validated: false,
    weaklySupported: false,
    matchedSourceTiers: [],
    matchedSourceUrls: [],
  } satisfies EvidenceCheck;
}

function addCheckIfPresent(
  checks: EvidenceCheck[],
  attribute: MatchAttribute,
  value: string | number | boolean | null | undefined,
  required: boolean,
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  checks.push(buildCheck(attribute, value, required));
}

function candidateMatchesBrand(
  candidate: PriceMatchCandidate,
  brandName: string | null | undefined,
) {
  if (!brandName) {
    return false;
  }

  return [candidate.brand, candidate.fullName, candidate.alias].some((value) =>
    textsOverlap(value, brandName),
  );
}

function candidateMatchesName(
  candidate: PriceMatchCandidate,
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    textsOverlap(candidate.fullName, value) ||
    textsOverlap(candidate.alias, value)
  );
}

function candidateMatchesSeries(
  candidate: PriceMatchCandidate,
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    textsOverlap(candidate.series, value) ||
    candidateMatchesName(candidate, value)
  );
}

function candidateMatchesBottler(
  candidate: PriceMatchCandidate,
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return textsOverlap(candidate.bottler, value);
}

function candidateMatchesDistillery(
  candidate: PriceMatchCandidate,
  values: string[] | null | undefined,
) {
  if (!values?.length) {
    return false;
  }

  return listMatchesExpectedValue(candidate.distillery, values);
}

function compareCandidateValue(
  attribute: MatchAttribute,
  candidate: PriceMatchCandidate,
  expectedValue: string | number | boolean,
) {
  switch (attribute) {
    case "brand":
      return candidateMatchesBrand(candidate, String(expectedValue));
    case "name":
      return candidateMatchesName(candidate, String(expectedValue));
    case "series":
      return candidateMatchesSeries(candidate, String(expectedValue));
    case "bottler":
      return candidateMatchesBottler(candidate, String(expectedValue));
    case "distillery":
      return candidateMatchesDistillery(candidate, [String(expectedValue)]);
    case "category":
      return candidate.category === expectedValue;
    case "statedAge":
      return candidate.statedAge === Number(expectedValue);
    case "edition":
      return textsOverlap(candidate.edition, String(expectedValue));
    case "caskType":
      return textsOverlap(candidate.caskType, String(expectedValue));
    case "caskSize":
      return textsOverlap(candidate.caskSize, String(expectedValue));
    case "caskFill":
      return textsOverlap(candidate.caskFill, String(expectedValue));
    case "caskStrength":
      return (
        candidate.caskStrength ===
        (expectedValue === true || expectedValue === "true")
      );
    case "singleCask":
      return (
        candidate.singleCask ===
        (expectedValue === true || expectedValue === "true")
      );
    case "abv":
      return (
        candidate.abv !== null &&
        Math.abs(candidate.abv - Number(expectedValue)) <= 0.3
      );
    case "vintageYear":
      return candidate.vintageYear === Number(expectedValue);
    case "releaseYear":
      return candidate.releaseYear === Number(expectedValue);
    default:
      return false;
  }
}

function hasMeaningfulExtractedReleaseValue(
  value: string | number | boolean | null | undefined,
): value is string | number | true {
  if (typeof value === "string") {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return value !== null && value !== undefined;
}

function bottleTargetRepresentsExtractedReleaseIdentity({
  target,
  attribute,
  expectedValue,
}: {
  target: PriceMatchCandidate;
  attribute: MatchAttribute;
  expectedValue: string | number | boolean;
}) {
  if (compareCandidateValue(attribute, target, expectedValue)) {
    return true;
  }

  return [target.alias, target.bottleFullName, target.fullName]
    .filter((value): value is string => Boolean(value))
    .some((value) =>
      attributeMatchesText(attribute, String(expectedValue), value),
    );
}

function listingCarriesReleaseIdentityBeyondBottle({
  target,
  extractedLabel,
}: {
  target: PriceMatchCandidate;
  extractedLabel: ExtractedBottleDetails | null;
}) {
  const extractedReleaseAttributes = [
    {
      attribute: "edition" as const,
      value: extractedLabel?.edition,
    },
    {
      attribute: "statedAge" as const,
      value: extractedLabel?.stated_age,
    },
    {
      attribute: "abv" as const,
      value: extractedLabel?.abv,
    },
    {
      attribute: "releaseYear" as const,
      value: extractedLabel?.release_year,
    },
    {
      attribute: "vintageYear" as const,
      value: extractedLabel?.vintage_year,
    },
    {
      attribute: "caskType" as const,
      value: extractedLabel?.cask_type,
    },
    {
      attribute: "caskSize" as const,
      value: extractedLabel?.cask_size,
    },
    {
      attribute: "caskFill" as const,
      value: extractedLabel?.cask_fill,
    },
    {
      attribute: "caskStrength" as const,
      value: extractedLabel?.cask_strength,
    },
    {
      attribute: "singleCask" as const,
      value: extractedLabel?.single_cask,
    },
  ];

  return extractedReleaseAttributes.some(({ attribute, value }) => {
    if (!hasMeaningfulExtractedReleaseValue(value)) {
      return false;
    }

    return !bottleTargetRepresentsExtractedReleaseIdentity({
      target,
      attribute,
      expectedValue: value,
    });
  });
}

function getCreateNewChecks(
  {
    proposedBottle,
    proposedRelease,
  }: {
    proposedBottle: ProposedBottle | null;
    proposedRelease: ProposedRelease | null;
  },
  candidates: PriceMatchCandidate[],
) {
  const allChecks: EvidenceCheck[] = [];

  if (proposedBottle) {
    addCheckIfPresent(allChecks, "brand", proposedBottle.brand.name, false);
    addCheckIfPresent(
      allChecks,
      "bottler",
      proposedBottle.bottler?.name,
      false,
    );
    addCheckIfPresent(allChecks, "name", proposedBottle.name, false);
    addCheckIfPresent(allChecks, "series", proposedBottle.series?.name, false);

    for (const distiller of proposedBottle.distillers) {
      addCheckIfPresent(allChecks, "distillery", distiller.name, false);
    }

    addCheckIfPresent(allChecks, "category", proposedBottle.category, false);
    addCheckIfPresent(allChecks, "statedAge", proposedBottle.statedAge, false);
    addCheckIfPresent(allChecks, "edition", proposedBottle.edition, false);
    addCheckIfPresent(allChecks, "caskType", proposedBottle.caskType, false);
    addCheckIfPresent(allChecks, "caskSize", proposedBottle.caskSize, false);
    addCheckIfPresent(allChecks, "caskFill", proposedBottle.caskFill, false);
    if (proposedBottle.caskStrength) {
      addCheckIfPresent(allChecks, "caskStrength", true, false);
    }
    if (proposedBottle.singleCask) {
      addCheckIfPresent(allChecks, "singleCask", true, false);
    }
    addCheckIfPresent(allChecks, "abv", proposedBottle.abv, false);
    addCheckIfPresent(
      allChecks,
      "vintageYear",
      proposedBottle.vintageYear,
      false,
    );
    addCheckIfPresent(
      allChecks,
      "releaseYear",
      proposedBottle.releaseYear,
      false,
    );
  }

  if (proposedRelease) {
    addCheckIfPresent(allChecks, "statedAge", proposedRelease.statedAge, false);
    addCheckIfPresent(allChecks, "edition", proposedRelease.edition, false);
    addCheckIfPresent(allChecks, "caskType", proposedRelease.caskType, false);
    addCheckIfPresent(allChecks, "caskSize", proposedRelease.caskSize, false);
    addCheckIfPresent(allChecks, "caskFill", proposedRelease.caskFill, false);
    if (proposedRelease.caskStrength) {
      addCheckIfPresent(allChecks, "caskStrength", true, false);
    }
    if (proposedRelease.singleCask) {
      addCheckIfPresent(allChecks, "singleCask", true, false);
    }
    addCheckIfPresent(allChecks, "abv", proposedRelease.abv, false);
    addCheckIfPresent(
      allChecks,
      "vintageYear",
      proposedRelease.vintageYear,
      false,
    );
    addCheckIfPresent(
      allChecks,
      "releaseYear",
      proposedRelease.releaseYear,
      false,
    );
  }

  const differentiatingAttributes = Array.from(
    new Set(
      allChecks
        .filter((check) =>
          candidates.some(
            (candidate) =>
              !compareCandidateValue(
                check.attribute,
                candidate,
                check.expectedValue,
              ),
          ),
        )
        .map((check) => check.attribute),
    ),
  );
  const requiredDifferentiatingAttributes = differentiatingAttributes.filter(
    (attribute) => WEB_VALIDATED_DIFFERENTIATORS.has(attribute),
  );

  const requiredAttributes =
    requiredDifferentiatingAttributes.length > 0
      ? new Set(requiredDifferentiatingAttributes)
      : new Set<MatchAttribute>(["brand", "name"]);

  return {
    differentiatingAttributes: Array.from(requiredAttributes),
    checks: allChecks.map((check) => ({
      ...check,
      required: requiredAttributes.has(check.attribute),
    })),
  };
}

function evaluateSearchEvidenceChecks({
  checks,
  searchEvidence,
  priceUrl,
  proposedBottle,
  extractedLabel,
  targetCandidate,
}: {
  checks: EvidenceCheck[];
  searchEvidence: SearchEvidence[];
  priceUrl: string;
  proposedBottle: ProposedBottle | null;
  extractedLabel: ExtractedBottleDetails | null;
  targetCandidate?: PriceMatchCandidate | null;
}) {
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
          priceUrl,
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

function getExistingMatchDecisiveAttributes({
  target,
  extractedLabel,
}: {
  target: PriceMatchCandidate;
  extractedLabel: ExtractedBottleDetails | null;
}) {
  const decisiveMatchAttributes = new Set<MatchAttribute>();
  const label = extractedLabel;

  if (label?.brand && candidateMatchesBrand(target, label.brand)) {
    decisiveMatchAttributes.add("brand");
  }

  if (label?.bottler && candidateMatchesBottler(target, label.bottler)) {
    decisiveMatchAttributes.add("bottler");
  }

  if (label?.expression && candidateMatchesName(target, label.expression)) {
    decisiveMatchAttributes.add("name");
  }

  if (label?.series && candidateMatchesSeries(target, label.series)) {
    decisiveMatchAttributes.add("series");
  }

  if (
    label?.distillery?.length &&
    candidateMatchesDistillery(target, label.distillery)
  ) {
    decisiveMatchAttributes.add("distillery");
  }

  if (label?.category && target.category === label.category) {
    decisiveMatchAttributes.add("category");
  }

  if (
    label &&
    label.stated_age !== null &&
    target.statedAge === label.stated_age
  ) {
    decisiveMatchAttributes.add("statedAge");
  }

  if (label?.edition && textsOverlap(target.edition, label.edition)) {
    decisiveMatchAttributes.add("edition");
  }

  if (label?.cask_type && textsOverlap(target.caskType, label.cask_type)) {
    decisiveMatchAttributes.add("caskType");
  }

  if (label?.cask_size && textsOverlap(target.caskSize, label.cask_size)) {
    decisiveMatchAttributes.add("caskSize");
  }

  if (label?.cask_fill && textsOverlap(target.caskFill, label.cask_fill)) {
    decisiveMatchAttributes.add("caskFill");
  }

  if (
    label &&
    label.cask_strength !== null &&
    target.caskStrength === label.cask_strength
  ) {
    decisiveMatchAttributes.add("caskStrength");
  }

  if (
    label &&
    label.single_cask !== null &&
    target.singleCask === label.single_cask
  ) {
    decisiveMatchAttributes.add("singleCask");
  }

  if (label && label.abv !== null && target.abv !== null) {
    const difference = Math.abs(target.abv - label.abv);
    if (difference <= 0.4) {
      decisiveMatchAttributes.add("abv");
    }
  }

  if (
    label &&
    label.vintage_year !== null &&
    target.vintageYear === label.vintage_year
  ) {
    decisiveMatchAttributes.add("vintageYear");
  }

  if (
    label &&
    label.release_year !== null &&
    target.releaseYear === label.release_year
  ) {
    decisiveMatchAttributes.add("releaseYear");
  }

  return Array.from(decisiveMatchAttributes);
}

function getExistingMatchAssessment({
  modelConfidence,
  suggestedBottleId,
  suggestedReleaseId,
  candidateBottles,
  extractedLabel,
}: {
  modelConfidence: number | null;
  suggestedBottleId: number | null;
  suggestedReleaseId: number | null;
  candidateBottles: PriceMatchCandidate[];
  extractedLabel: ExtractedBottleDetails | null;
}) {
  const target = getSuggestedMatchCandidate({
    suggestedBottleId,
    suggestedReleaseId,
    candidateBottles,
  });
  if (!target) {
    return {
      automationScore: null,
      decisiveMatchAttributes: [] as MatchAttribute[],
      structuredMatchRequiresStatedAge: false,
      automationBlockers: [] as string[],
    };
  }

  const automationBlockers: string[] = [];
  if (
    target.releaseId === null &&
    listingCarriesReleaseIdentityBeyondBottle({
      target,
      extractedLabel,
    })
  ) {
    automationBlockers.push(
      "listing looks release-specific but the suggested target is only a bottle",
    );
  }

  automationBlockers.push(
    ...getExistingMatchIdentityConflicts({
      target,
      extractedLabel,
    }),
  );

  return {
    // For existing matches, the reviewed classifier confidence is the only
    // signal we trust enough to summarize numerically. Downstream automation
    // still records blockers and matched attributes, but it does not rescore
    // bottle identity independently of the classifier.
    automationScore:
      modelConfidence === null ? null : clampScore(modelConfidence),
    decisiveMatchAttributes: getExistingMatchDecisiveAttributes({
      target,
      extractedLabel,
    }),
    structuredMatchRequiresStatedAge:
      extractedLabel?.stated_age !== null &&
      extractedLabel?.stated_age !== undefined,
    automationBlockers: Array.from(new Set(automationBlockers)),
  };
}

function getCreateNewScore({
  proposedBottle,
  proposedRelease,
  creationTarget,
  candidateBottles,
  searchEvidence,
  extractedLabel,
  price,
}: {
  proposedBottle: ProposedBottle | null;
  proposedRelease: ProposedRelease | null;
  creationTarget: MatchCreationTarget | null;
  candidateBottles: PriceMatchCandidate[];
  searchEvidence: SearchEvidence[];
  extractedLabel: ExtractedBottleDetails | null;
  price: Pick<StorePrice, "bottleId" | "name" | "url"> & {
    releaseId?: number | null;
  };
}) {
  let score = creationTarget === "release" ? 24 : 30;
  const automationBlockers: string[] = [];

  if (creationTarget !== "release" && !proposedBottle?.category) {
    automationBlockers.push("auto-create requires a concrete whisky category");
  }

  if (proposedBottle?.brand.name) {
    score += 8;
  }
  if (proposedBottle?.bottler?.name) {
    score += 5;
  }
  if (proposedBottle?.name) {
    score += 10;
  }
  if (proposedBottle?.series?.name) {
    score += 6;
  }
  if (proposedBottle && proposedBottle.distillers.length > 0) {
    score += 5;
  }
  if (proposedBottle?.category) {
    score += 4;
  }
  if (
    proposedBottle?.statedAge !== null ||
    proposedRelease?.statedAge !== null
  ) {
    score += 6;
  }
  if (proposedBottle?.edition || proposedRelease?.edition) {
    score += 8;
  }
  if (proposedBottle?.caskType || proposedRelease?.caskType) {
    score += 8;
  }
  if (proposedBottle?.caskSize || proposedRelease?.caskSize) {
    score += 4;
  }
  if (proposedBottle?.caskFill || proposedRelease?.caskFill) {
    score += 4;
  }
  if (proposedBottle?.caskStrength || proposedRelease?.caskStrength) {
    score += 5;
  }
  if (proposedBottle?.singleCask || proposedRelease?.singleCask) {
    score += 5;
  }
  if (proposedBottle?.abv !== null || proposedRelease?.abv !== null) {
    score += 12;
  }
  if (
    proposedBottle?.vintageYear !== null ||
    proposedRelease?.vintageYear !== null
  ) {
    score += 6;
  }
  if (
    proposedBottle?.releaseYear !== null ||
    proposedRelease?.releaseYear !== null
  ) {
    score += 6;
  }
  if (creationTarget === "release" && price.bottleId !== null) {
    score += 8;
  }
  if (creationTarget === "bottle_and_release") {
    score += 4;
  }

  const { checks, differentiatingAttributes } = getCreateNewChecks(
    {
      proposedBottle,
      proposedRelease,
    },
    candidateBottles.slice(0, 3),
  );
  const evaluatedChecks = evaluateSearchEvidenceChecks({
    checks,
    searchEvidence,
    priceUrl: price.url,
    proposedBottle,
    extractedLabel,
  });

  if (!candidateBottles.length) {
    score += 6;
  } else {
    score += Math.min(differentiatingAttributes.length * 4, 12);
  }

  const requiredChecks = evaluatedChecks.filter((check) => check.required);
  const validatedRequiredChecks = requiredChecks.filter(
    (check) => check.validated,
  );

  if (!searchEvidence.some((evidence) => evidence.results.length > 0)) {
    automationBlockers.push("no web evidence validated this bottle");
  }

  if (
    requiredChecks.some((check) => !check.validated && !check.weaklySupported)
  ) {
    automationBlockers.push(
      "authoritative web evidence did not validate the differentiating bottle traits",
    );
  }

  if (
    requiredChecks.some(
      (check) =>
        !check.validated &&
        check.weaklySupported &&
        check.matchedSourceTiers.includes("origin_retailer"),
    )
  ) {
    automationBlockers.push(
      "the originating retailer is not decisive evidence for auto-create",
    );
  }

  if (
    requiredChecks.length > 0 &&
    validatedRequiredChecks.length === 0 &&
    requiredChecks.some((check) => check.weaklySupported)
  ) {
    automationBlockers.push(
      "web evidence only weakly corroborated the match through retailer or unknown sources",
    );
  }

  score += validatedRequiredChecks.length * 12;

  if (
    evaluatedChecks.some((check) =>
      check.matchedSourceTiers.includes("official"),
    )
  ) {
    score += 8;
  } else if (
    evaluatedChecks.some((check) => check.matchedSourceTiers.includes("critic"))
  ) {
    score += 4;
  }

  const hasBlockers = automationBlockers.length > 0;
  const automationScore = hasBlockers
    ? Math.min(clampScore(score), AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD - 1)
    : clampScore(score);

  return {
    automationScore,
    automationEligible:
      !hasBlockers && automationScore >= AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD,
    automationBlockers: Array.from(new Set(automationBlockers)),
    differentiatingAttributes,
    decisiveMatchAttributes: Array.from(
      new Set(
        evaluatedChecks
          .filter((check) => check.validated)
          .map((check) => check.attribute),
      ),
    ),
    webEvidenceChecks: evaluatedChecks,
  };
}

export function getStorePriceMatchAutomationAssessment({
  action,
  modelConfidence,
  price,
  suggestedBottleId,
  suggestedReleaseId,
  candidateBottles,
  extractedLabel,
  proposedBottle,
  proposedRelease,
  creationTarget,
  searchEvidence,
}: MatchAutomationInput): StorePriceMatchAutomationAssessment {
  if (
    (action === "create_new" || action === "correction") &&
    (proposedBottle || proposedRelease)
  ) {
    const createScore = getCreateNewScore({
      proposedBottle,
      proposedRelease: proposedRelease ?? null,
      creationTarget: creationTarget ?? null,
      candidateBottles,
      searchEvidence,
      extractedLabel,
      price,
    });

    return {
      modelConfidence,
      ...createScore,
      automationEligible:
        action === "create_new" ? createScore.automationEligible : false,
    };
  }

  if (action === "match_existing" || action === "correction") {
    const matchAssessment = getExistingMatchAssessment({
      modelConfidence,
      suggestedBottleId,
      suggestedReleaseId: suggestedReleaseId ?? null,
      candidateBottles,
      extractedLabel,
    });

    return {
      modelConfidence,
      automationScore: matchAssessment.automationScore,
      automationEligible: false,
      automationBlockers: matchAssessment.automationBlockers,
      decisiveMatchAttributes: matchAssessment.decisiveMatchAttributes,
      structuredMatchRequiresStatedAge:
        matchAssessment.structuredMatchRequiresStatedAge,
      differentiatingAttributes: [],
      webEvidenceChecks: [],
    };
  }

  return {
    modelConfidence,
    automationScore: null,
    automationEligible: false,
    automationBlockers: [],
    decisiveMatchAttributes: [],
    structuredMatchRequiresStatedAge: false,
    differentiatingAttributes: [],
    webEvidenceChecks: [],
  };
}

function getSuggestedMatchCandidate({
  suggestedBottleId,
  suggestedReleaseId,
  candidateBottles,
}: {
  suggestedBottleId: number | null;
  suggestedReleaseId: number | null;
  candidateBottles: PriceMatchCandidate[];
}) {
  if (suggestedBottleId === null) {
    return null;
  }

  return (
    candidateBottles.find(
      (candidate) =>
        candidate.bottleId === suggestedBottleId &&
        (suggestedReleaseId !== null
          ? (candidate.releaseId ?? null) === suggestedReleaseId
          : (candidate.releaseId ?? null) === null ||
            candidate.kind !== "release"),
    ) ?? null
  );
}

function hasHighConfidenceStructuredMatch(
  decisiveMatchAttributes: MatchAttribute[],
  structuredMatchRequiresStatedAge: boolean,
) {
  const matchedAttributes = new Set(decisiveMatchAttributes);

  const requiredAttributes = structuredMatchRequiresStatedAge
    ? [...HIGH_CONFIDENCE_STRUCTURED_MATCH_REQUIRED_ATTRIBUTES, "statedAge"]
    : HIGH_CONFIDENCE_STRUCTURED_MATCH_REQUIRED_ATTRIBUTES;

  return requiredAttributes.every((attribute) =>
    matchedAttributes.has(attribute),
  );
}

export function shouldVerifyStorePriceMatch({
  action,
  price,
  suggestedBottleId,
  suggestedReleaseId,
  modelConfidence,
  automationBlockers,
  decisiveMatchAttributes,
  structuredMatchRequiresStatedAge = false,
  candidateBottles,
}: {
  action: MatchAction;
  price: Pick<StorePrice, "bottleId"> & {
    releaseId?: number | null;
  };
  suggestedBottleId: number | null;
  suggestedReleaseId: number | null;
  modelConfidence: number | null;
  automationBlockers: string[];
  decisiveMatchAttributes: MatchAttribute[];
  structuredMatchRequiresStatedAge?: boolean;
  candidateBottles: PriceMatchCandidate[];
}) {
  if (action !== "match_existing" || suggestedBottleId === null) {
    return false;
  }

  if (modelConfidence === null || automationBlockers.length > 0) {
    return false;
  }

  const target = getSuggestedMatchCandidate({
    suggestedBottleId,
    suggestedReleaseId,
    candidateBottles,
  });

  const reaffirmsCurrentAssignment =
    price.bottleId !== null &&
    suggestedBottleId === price.bottleId &&
    (suggestedReleaseId ?? null) === (price.releaseId ?? null);
  if (
    reaffirmsCurrentAssignment &&
    (modelConfidence >= VERIFIED_MATCH_CONFIDENCE_THRESHOLD ||
      target?.source.includes("exact") === true)
  ) {
    return true;
  }

  if (price.bottleId !== null) {
    return false;
  }

  if (
    // Let the classifier break ties for bottle-only matches once the extracted
    // identity already confirmed the stable bottle fields we trust.
    suggestedReleaseId === null &&
    modelConfidence >=
      HIGH_CONFIDENCE_STRUCTURED_MATCH_MODEL_CONFIDENCE_THRESHOLD &&
    hasHighConfidenceStructuredMatch(
      decisiveMatchAttributes,
      structuredMatchRequiresStatedAge,
    )
  ) {
    return true;
  }

  return (
    target?.source.includes("exact") === true &&
    modelConfidence >= HIGH_CONFIDENCE_EXACT_MATCH_MODEL_CONFIDENCE_THRESHOLD
  );
}
