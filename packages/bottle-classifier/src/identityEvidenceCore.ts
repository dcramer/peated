import type {
  BottleEvidenceSourceTier,
  BottleSearchEvidence,
} from "./classifierTypes";
import { normalizeString } from "./normalize";

/**
 * Shared low-level evidence primitives used by both classifier review and
 * price-matching evidence checks.
 *
 * Keep policy decisions in the consumer modules. This file should only hold
 * reusable text normalization, source-origin classification, and evidence
 * matching helpers so those consumers do not drift on the basics.
 */

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

export function normalizeComparablePhrase(
  value: string | null | undefined,
): string {
  return normalizeComparableText(value)
    .replace(/[^a-z0-9]+/g, "")
    .trim();
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

export function classifySearchResultSource({
  result,
  sourceUrl,
}: {
  result: BottleSearchEvidence["results"][number];
  sourceUrl: string;
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

  return "external";
}

/**
 * Matches explicit ABV text, plus numeric proof only when the caller has
 * structured context that makes the U.S. proof scale deterministic.
 */
export function getAbvSupportLevel(
  text: string,
  expectedValue: number,
  options: { usProofEligible?: boolean } = {},
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

  const proofValues = getUsProofValues(text, options).map((value) => value / 2);

  if (proofValues.some((value) => Math.abs(value - expectedValue) <= 0.05)) {
    return "exact";
  }

  if (proofValues.some((value) => Math.abs(value - expectedValue) <= 0.3)) {
    return "close";
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

function getUsProofValues(
  text: string,
  { usProofEligible = false }: { usProofEligible?: boolean },
): number[] {
  const values: number[] = [];
  const explicitUsProofPatterns = [
    /\b(\d{1,3}(?:\.\d+)?)\s*(?:-| )?\s*(?:u\.?s\.?|united states)\s*proof\b/gi,
    /\b(?:u\.?s\.?|united states)\s*proof\s*:\s*(\d{1,3}(?:\.\d+)?)\b/gi,
  ];
  const proofPatterns = usProofEligible
    ? [
        ...explicitUsProofPatterns,
        /\b(\d{1,3}(?:\.\d+)?)\s*(?:-| )?\s*proof\b/gi,
        /\bproof\s*:\s*(\d{1,3}(?:\.\d+)?)\b/gi,
      ]
    : explicitUsProofPatterns;

  for (const pattern of proofPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (!Number.isFinite(value) || value < 0 || value > 200) {
        continue;
      }

      values.push(value);
    }
  }

  return values;
}
