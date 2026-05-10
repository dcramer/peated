import type { BottleCandidate } from "./classifierTypes";
import { normalizeString } from "./normalize";

const EXACT_CASK_CODE_PATTERN = /\b([A-Z]{0,4}\d+\.\d+)\b/gi;
const MEASUREMENT_SUFFIX_PATTERN =
  /^\s*(?:%|\b(?:abv|alc\.?|alcohol|proof)\b)/i;

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
  if (!anchor || candidate.releaseId !== null || candidate.kind === "release") {
    return false;
  }

  return [candidate.alias, candidate.bottleFullName, candidate.fullName].some(
    (value) => getExactCaskCodeAnchor(value) === anchor,
  );
}
