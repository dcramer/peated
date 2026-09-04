import {
  AgentBottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleClassificationDecision,
  type BottleExtractedDetails,
  type BottleSearchEvidence,
  type EntityResolution,
} from "../classifierTypes";
import type {
  AuditBottleInput,
  BottleContext,
  BottleReferenceInput,
} from "../contract";
import type { ImageBottleEvidence } from "../imageEvidence";

const DEFAULT_MATCH_CANDIDATE_LIMIT = 15;

function buildAgentEntityResolution(entity: EntityResolution) {
  return {
    ...entity,
    retrievedFor: entity.retrievedFor?.map(({ query }) => ({ query })),
  };
}

export function buildAgentInput({
  reference,
  extractedIdentity,
  imageEvidence,
  initialCandidates,
  currentBottle,
  hasExactReferenceMatch,
  searchEvidence = [],
  resolvedEntities = [],
  identityAnchor = null,
}: {
  reference: BottleReferenceInput;
  extractedIdentity: BottleExtractedDetails | null;
  imageEvidence?: ImageBottleEvidence | null;
  initialCandidates: BottleCandidate[];
  currentBottle: BottleCandidate | null;
  hasExactReferenceMatch: boolean;
  searchEvidence?: BottleSearchEvidence[];
  resolvedEntities?: EntityResolution[];
  identityAnchor?: BottleClassificationDecision | null;
}): string {
  /**
   * The model should see the reference facts used for identity, extracted
   * identity, photo evidence, and local candidate context in one stable
   * envelope. Runtime-only correlation fields stay outside this boundary.
   */
  return JSON.stringify(
    {
      reference: {
        name: reference.name,
        url: reference.url ?? null,
        imageUrl: reference.imageUrl ?? null,
        currentBottleId: reference.currentBottleId ?? null,
      },
      currentBottle: currentBottle
        ? AgentBottleCandidateSchema.parse(currentBottle)
        : null,
      extractedIdentity,
      imageEvidence: imageEvidence ?? null,
      localSearch: {
        hasExactReferenceMatch,
        candidates: initialCandidates.map((candidate) =>
          AgentBottleCandidateSchema.parse(candidate),
        ),
      },
      webEvidence: {
        results: searchEvidence,
      },
      localEntitySearch: {
        results: resolvedEntities.map(buildAgentEntityResolution),
      },
      identityAnchor,
    },
    null,
    2,
  );
}

export function buildAuditBottleAgentInput({
  audit,
  reference,
  extractedIdentity,
  imageEvidence,
  initialCandidates,
  currentBottleContext,
  searchEvidence = [],
  resolvedEntities = [],
  identityAnchor = null,
  availableSourceEvidenceFields,
}: {
  audit: AuditBottleInput;
  reference: BottleReferenceInput;
  extractedIdentity: BottleExtractedDetails | null;
  imageEvidence?: ImageBottleEvidence | null;
  initialCandidates: BottleCandidate[];
  currentBottleContext: BottleContext;
  searchEvidence?: BottleSearchEvidence[];
  resolvedEntities?: EntityResolution[];
  identityAnchor?: BottleClassificationDecision | null;
  availableSourceEvidenceFields: readonly string[];
}): string {
  return JSON.stringify(
    {
      intent: "audit_bottle",
      audit: {
        bottleId: audit.bottleId,
        origin: audit.origin,
        note: audit.note ?? null,
      },
      reference: {
        name: reference.name,
        url: reference.url ?? null,
        imageUrl: reference.imageUrl ?? null,
        currentBottleId: reference.currentBottleId ?? null,
      },
      extractedIdentity,
      imageEvidence: imageEvidence ?? null,
      localSearch: {
        candidates: initialCandidates.map((candidate) =>
          AgentBottleCandidateSchema.parse(candidate),
        ),
      },
      localEntitySearch: {
        results: resolvedEntities.map(buildAgentEntityResolution),
      },
      currentBottleContext,
      webEvidence: {
        results: searchEvidence,
      },
      identityAnchor,
      availableSourceEvidenceFields,
    },
    null,
    2,
  );
}

export function buildDefaultBottleSearchInput({
  reference,
  extractedIdentity,
}: {
  reference: BottleReferenceInput;
  extractedIdentity: BottleExtractedDetails | null;
}): BottleCandidateSearchInput {
  /**
   * This is the cheap local-search seed used before the model asks for any
   * follow-up retrieval. It should stay conservative: only pass through fields
   * intended as identity constraints.
   */
  return BottleCandidateSearchInputSchema.parse({
    query: reference.name,
    brand: extractedIdentity?.brand ?? null,
    bottler: extractedIdentity?.bottler ?? null,
    expression: extractedIdentity?.expression ?? null,
    series: extractedIdentity?.series ?? null,
    distillery: extractedIdentity?.distillery ?? [],
    category: extractedIdentity?.category ?? null,
    stated_age: extractedIdentity?.stated_age ?? null,
    abv: extractedIdentity?.abv ?? null,
    cask_strength: extractedIdentity?.cask_strength ?? null,
    single_cask: extractedIdentity?.single_cask ?? null,
    maturation: null,
    cask_number: extractedIdentity?.cask_number ?? null,
    outturn: null,
    edition: extractedIdentity?.edition ?? null,
    vintage_year: extractedIdentity?.vintage_year ?? null,
    release_year: extractedIdentity?.release_year ?? null,
    currentBottleId: reference.currentBottleId ?? null,
    limit: DEFAULT_MATCH_CANDIDATE_LIMIT,
  });
}
