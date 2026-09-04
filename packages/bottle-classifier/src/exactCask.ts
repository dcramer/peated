import type { BottleCandidate } from "./classifierTypes";
import { normalizeString } from "./normalize";

const EXACT_CASK_CODE_PATTERN = /\b([A-Z]{0,4}\d+\.\d+)\b/gi;
const MEASUREMENT_SUFFIX_PATTERN =
  /^\s*(?:%|\b(?:abv|alc\.?|alcohol|proof)\b)/i;
const MARKED_CASK_CODE_PATTERN =
  /\b(?:cask|barrel)(?:\s+(?:no|number)\.?)?\s*#?\s*((?=[a-z0-9./-]*\d)[a-z0-9]+(?:[./-][a-z0-9]+)*)\b/gi;
const STANDALONE_NUMBER_PATTERN =
  /(?:^|\()\s*(?:no|number)\.?\s*#?\s*([a-z0-9]+(?:[./-][a-z0-9]+)*)\s*(?:\)|$)/i;
const AGE_LIKE_CODE_PATTERN =
  /^\d+(?:[./-])?(?:years?|yrs?|yo)(?:[./-]?old)?$/i;

function normalizeMarketedCaskCode(value: string): string | null {
  const code = normalizeString(value).replace(/^#/, "").toUpperCase();
  if (!/\d/.test(code) || AGE_LIKE_CODE_PATTERN.test(code)) {
    return null;
  }

  return code;
}

export function getExactCaskCodeAnchor(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeString(value ?? "");

  for (const match of normalizedValue.matchAll(EXACT_CASK_CODE_PATTERN)) {
    const code = match[1];
    if (!code) {
      continue;
    }

    const suffix = normalizedValue.slice((match.index ?? 0) + code.length);
    if (MEASUREMENT_SUFFIX_PATTERN.test(suffix)) {
      continue;
    }

    return code.toUpperCase();
  }

  return null;
}

export function candidateHasExactCaskCodeAnchor(
  candidate: BottleCandidate,
  anchor: string | null,
): boolean {
  if (!anchor) {
    return false;
  }

  return [candidate.reference, candidate.fullName].some(
    (value) => getExactCaskCodeAnchor(value) === anchor,
  );
}

export function getMarketedCaskCodeAnchor(
  value: string | null | undefined,
  options: {
    allowBareCode?: boolean;
    allowProgramCode?: boolean;
    allowStandaloneNumber?: boolean;
  } = {},
): string | null {
  const normalizedValue = normalizeString(value ?? "");
  if (options.allowBareCode) {
    return normalizeMarketedCaskCode(normalizedValue);
  }

  if (options.allowProgramCode) {
    const exactCaskCode = getExactCaskCodeAnchor(normalizedValue);
    if (exactCaskCode) {
      return exactCaskCode;
    }
  }

  for (const match of normalizedValue.matchAll(MARKED_CASK_CODE_PATTERN)) {
    const markedCode = match[1] ? normalizeMarketedCaskCode(match[1]) : null;
    if (markedCode) {
      return markedCode;
    }
  }

  if (!options.allowStandaloneNumber) {
    return null;
  }

  const standaloneCode = normalizedValue.match(STANDALONE_NUMBER_PATTERN)?.[1];
  return standaloneCode ? normalizeMarketedCaskCode(standaloneCode) : null;
}

export function getCandidateMarketedCaskCodeAnchor(
  candidate: BottleCandidate,
): string | null {
  const structuredCode = candidate.caskNumber
    ? normalizeMarketedCaskCode(candidate.caskNumber)
    : null;
  if (structuredCode) {
    return structuredCode;
  }

  const allowStandaloneNumber =
    candidate.singleCask === true ||
    [candidate.reference, candidate.fullName].some((value) =>
      /\bsingle\s+(?:cask|barrel)\b/i.test(value ?? ""),
    );
  const allowProgramCode =
    candidate.singleCask === true ||
    [candidate.edition, candidate.reference, candidate.fullName].some((value) =>
      /\b(?:smws|scotch malt whisky society)\b/i.test(value ?? ""),
    );

  for (const value of [
    candidate.edition,
    candidate.reference,
    candidate.fullName,
  ]) {
    const code = getMarketedCaskCodeAnchor(value, {
      allowProgramCode,
      allowStandaloneNumber,
    });
    if (code) {
      return code;
    }
  }

  return null;
}
