import type {
  BottleCandidate,
  BottleClassificationDecision,
  BottleClassifierAgentDecision,
  BottleObservation,
} from "./classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "./contract";
import { normalizeComparableText } from "./identityEvidenceCore";

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

function isKnownExactCaskProgramBrand(
  value: string | null | undefined,
): boolean {
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

export function hasExactCaskSignals({
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

  return hasSpecificCaskReference || hasCodeOrNumberSignal;
}

export function inferBottleIdentityScope({
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

  if (requestedIdentityScope !== "exact_cask") {
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

  return "product";
}
