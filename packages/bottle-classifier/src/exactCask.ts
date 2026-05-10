import type { BottleCandidate } from "./classifierTypes";
import { normalizeString } from "./normalize";

export function getExactCaskCodeAnchor(
  value: string | null | undefined,
): string | null {
  const match = normalizeString(value ?? "").match(/\b([A-Z]{0,4}\d+\.\d+)\b/i);

  return match?.[1]?.toUpperCase() ?? null;
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
