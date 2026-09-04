import type { BottleReferenceRun } from "@peated/bottle-classifier";
import {
  BottleCandidateSchema,
  createDecidedBottleClassification,
  type ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import type { BottleCandidate } from "@peated/bottle-classifier/internal/types";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";

/**
 * Returns one literal stored-reference candidate. A caller can accept its assigned
 * Bottle as a deterministic Match without a classifier model call.
 */
export async function findExactReferenceBottleCandidate(
  referenceName: string,
): Promise<BottleCandidate | null> {
  const assignment = await findBottleReferenceAssignment(referenceName);
  if (!assignment) {
    return null;
  }

  const candidate = await getBottleCandidateById(assignment.bottleId);
  if (!candidate) {
    return null;
  }

  return BottleCandidateSchema.parse({
    ...candidate,
    reference: assignment.reference.name,
    source: Array.from(new Set([...candidate.source, "exact"])),
  });
}

/** Reuses an accepted Bottle Reference without spending a classifier call. */
export async function resolveExactReferenceBottleRun(
  input: ClassifyBottleReferenceInput,
): Promise<BottleReferenceRun | null> {
  const candidate = await findExactReferenceBottleCandidate(
    input.reference.name,
  );
  if (!candidate) {
    return null;
  }

  return {
    result: createDecidedBottleClassification({
      decision: {
        action: "match",
        rationale: "A literal stored Bottle reference identifies this Bottle.",
        candidateBottleIds: [candidate.bottleId],
        identityScope: "product",
        referenceScope: "none",
        observation: null,
        confidenceBasis: {
          unresolvedRisks: [],
          webEvidence: "not_needed",
        },
        matchedBottleId: candidate.bottleId,
        proposedBottle: null,
      },
      artifacts: {
        extractedIdentity: input.extractedIdentity ?? null,
        imageEvidence: input.imageEvidence ?? null,
        candidates: [candidate],
      },
    }),
    modelMetadata: null,
  };
}
