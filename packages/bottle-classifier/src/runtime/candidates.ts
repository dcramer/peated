import { mergeBottleCandidateFamilyContext } from "../candidateFamilyContext";
import type { BottleCandidate, EntityResolution } from "../classifierTypes";

const CANDIDATE_METADATA_FIELDS = [
  "bottler",
  "series",
  "category",
  "statedAge",
  "edition",
  "caskStrength",
  "singleCask",
  "caskType",
  "caskSize",
  "caskFill",
  "abv",
  "vintageYear",
  "releaseYear",
] as const satisfies ReadonlyArray<keyof BottleCandidate>;

export function mergeBottleCandidate(
  candidates: Map<number, BottleCandidate>,
  candidate: BottleCandidate,
) {
  /**
   * Candidate results can arrive from exact match retrieval, local search, web
   * follow-up, or current-bottle hydration. We merge by Bottle identity
   * so the runtime keeps one row per canonical candidate while preserving the
   * strongest score and any extra metadata discovered later.
   */
  const existing = candidates.get(candidate.bottleId);
  if (!existing) {
    candidates.set(candidate.bottleId, candidate);
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

  existing.familyContext = mergeBottleCandidateFamilyContext(
    existing.familyContext,
    candidate.familyContext,
  );

  if (!existing.distillery.length && candidate.distillery.length) {
    existing.distillery = candidate.distillery;
  } else if (candidate.distillery.length) {
    existing.distillery = Array.from(
      new Set([...existing.distillery, ...candidate.distillery]),
    );
  }

  for (const field of CANDIDATE_METADATA_FIELDS) {
    fillMissingCandidateField(existing, candidate, field);
  }
}

function fillMissingCandidateField<
  TField extends (typeof CANDIDATE_METADATA_FIELDS)[number],
>(existing: BottleCandidate, candidate: BottleCandidate, field: TField): void {
  if (existing[field] === null && candidate[field] !== null) {
    existing[field] = candidate[field];
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
  const retrievedFor = [...(existing.retrievedFor ?? [])];
  for (const provenance of entity.retrievedFor ?? []) {
    if (
      !retrievedFor.some(
        (existingProvenance) =>
          existingProvenance.query === provenance.query &&
          existingProvenance.requestedType === provenance.requestedType,
      )
    ) {
      retrievedFor.push(provenance);
    }
  }
  if (retrievedFor.length > 0) {
    existing.retrievedFor = retrievedFor;
  }

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
