import type { BottleCandidate, EntityResolution } from "../classifierTypes";

const CANDIDATE_METADATA_FIELDS = [
  "bottler",
  "series",
  "category",
  "statedAge",
  "edition",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
  "caskType",
  "caskSize",
  "caskFill",
] as const satisfies ReadonlyArray<keyof BottleCandidate>;

function getBottleCandidateKey(
  candidate: Pick<BottleCandidate, "bottleId" | "releaseId" | "kind">,
) {
  return candidate.releaseId !== null || candidate.kind === "release"
    ? `release:${candidate.releaseId ?? "missing"}`
    : `bottle:${candidate.bottleId}`;
}

export function mergeBottleCandidate(
  candidates: Map<string, BottleCandidate>,
  candidate: BottleCandidate,
) {
  /**
   * Candidate results can arrive from exact match retrieval, local search, web
   * follow-up, or current-bottle hydration. We merge by bottle/release identity
   * so the runtime keeps one row per canonical candidate while preserving the
   * strongest score and any extra metadata discovered later.
   */
  const key = getBottleCandidateKey(candidate);
  const existing = candidates.get(key);
  if (!existing) {
    candidates.set(key, candidate);
    return;
  }

  existing.source = Array.from(
    new Set([...existing.source, ...candidate.source]),
  );

  if (
    candidate.score !== null &&
    (existing.score === null || candidate.score > existing.score)
  ) {
    existing.score = candidate.score;
  }

  if (!existing.alias && candidate.alias) {
    existing.alias = candidate.alias;
  }

  if (!existing.series && candidate.series) {
    existing.series = candidate.series;
  }

  if (!existing.bottler && candidate.bottler) {
    existing.bottler = candidate.bottler;
  }

  if (!existing.distillery.length && candidate.distillery.length) {
    existing.distillery = candidate.distillery;
  } else if (candidate.distillery.length) {
    existing.distillery = Array.from(
      new Set([...existing.distillery, ...candidate.distillery]),
    );
  }

  const existingMetadata = existing as Record<
    (typeof CANDIDATE_METADATA_FIELDS)[number],
    BottleCandidate[(typeof CANDIDATE_METADATA_FIELDS)[number]]
  >;

  for (const field of CANDIDATE_METADATA_FIELDS) {
    const existingValue = existingMetadata[field];
    const candidateValue = candidate[field];

    if (existingValue === null && candidateValue !== null) {
      existingMetadata[field] = candidateValue;
    }
  }
}

export function mergeResolvedEntity(
  entities: Map<number, EntityResolution>,
  entity: EntityResolution,
): void {
  /**
   * Entity search is additive and opportunistic. Prefer the highest-confidence
   * hit, but preserve alternate evidence sources and any alias/short-name
   * metadata the first result may not have carried.
   */
  const existing = entities.get(entity.entityId);
  if (!existing) {
    entities.set(entity.entityId, entity);
    return;
  }

  existing.source = Array.from(new Set([...existing.source, ...entity.source]));

  if (
    entity.score !== null &&
    (existing.score === null || entity.score > existing.score)
  ) {
    existing.score = entity.score;
  }

  if (!existing.alias && entity.alias) {
    existing.alias = entity.alias;
  }

  if (!existing.shortName && entity.shortName) {
    existing.shortName = entity.shortName;
  }
}
