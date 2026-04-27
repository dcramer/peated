import type {
  BottleCandidate,
  BottleEvidenceSourceTier,
  BottleExtractedDetails,
  BottleSearchEvidence,
  ProposedBottle,
} from "./classifierTypes";
import { normalizeString } from "./normalize";

/**
 * Shared low-level evidence primitives used by both classifier review and
 * price-matching evidence checks.
 *
 * Keep policy decisions in the consumer modules. This file should only hold
 * reusable text normalization, source-tier classification, and evidence
 * matching helpers so those consumers do not drift on the basics.
 */

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

const OFFICIAL_DOMAIN_SUFFIXES = [
  "bourbon",
  "distillery",
  "distilling",
  "gin",
  "malt",
  "rum",
  "scotch",
  "spirits",
  "whiskey",
  "whisky",
];

export const AUTHORITATIVE_SOURCE_TIERS = new Set<BottleEvidenceSourceTier>([
  "official",
  "critic",
]);

export function normalizeComparableText(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  return normalizeString(value).toLowerCase().replace(/_/g, " ").trim();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsComparablePhrase(
  haystack: string,
  needle: string,
): boolean {
  if (!haystack || !needle) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`,
  );

  return pattern.test(haystack);
}

export function textsOverlap(
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

export function getComparableDomain(
  url: string | null | undefined,
): string | null {
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

export function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getComparableDomainLabel(hostname: string): string | null {
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length < 2) {
    return null;
  }

  const registrableLabel =
    labels.length >= 3 &&
    labels.at(-2)?.length === 2 &&
    labels.at(-1)?.length === 2
      ? labels.at(-3)
      : labels.at(-2);

  return registrableLabel?.replace(/[^a-z0-9]+/g, "") ?? null;
}

function domainLooksProducerOwned(hostname: string, producerPhrase: string) {
  const domainLabel = getComparableDomainLabel(hostname);
  if (!domainLabel || !producerPhrase) {
    return false;
  }

  if (domainLabel === producerPhrase) {
    return true;
  }

  if (!domainLabel.startsWith(producerPhrase)) {
    return false;
  }

  const suffix = domainLabel.slice(producerPhrase.length);
  return OFFICIAL_DOMAIN_SUFFIXES.includes(suffix);
}

export function normalizeComparablePhrase(
  value: string | null | undefined,
): string {
  return normalizeComparableText(value)
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function buildProducerIdentityPhrases({
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

export function listMatchesExpectedValue(
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

export function getSearchResultText(
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

export function classifySourceTier({
  result,
  sourceUrl,
  producerPhrases,
}: {
  result: BottleSearchEvidence["results"][number];
  sourceUrl: string;
  producerPhrases: Set<string>;
}): BottleEvidenceSourceTier {
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
      domainLooksProducerOwned(resultDomain, phrase),
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

export function getAbvSupportLevel(
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
