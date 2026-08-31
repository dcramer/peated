import type {
  EntityClassificationAdvice,
  EntityClassificationContext,
} from "./classifierTypes";
import type { EntityClassificationArtifacts } from "./contract";

function insufficientEvidenceAdvice({
  advice,
  reason,
}: {
  advice: EntityClassificationAdvice;
  reason: string;
}): EntityClassificationAdvice {
  return {
    ...advice,
    kind: "insufficient_evidence",
    summary: `${advice.summary} ${reason}`,
    targetEntityId: null,
  };
}

function isKnownTarget({
  targetEntityId,
  context,
  artifacts,
}: {
  targetEntityId: number | null;
  context: EntityClassificationContext;
  artifacts: EntityClassificationArtifacts;
}) {
  if (targetEntityId === null) {
    return false;
  }

  return (
    context.candidateTargets.some(
      (target) => target.entityId === targetEntityId,
    ) ||
    artifacts.resolvedEntities.some(
      (entity) => entity.entityId === targetEntityId,
    )
  );
}

function getKnownEvidenceUrls(
  context: EntityClassificationContext,
  artifacts: EntityClassificationArtifacts,
) {
  return new Set(
    [
      context.entity.website,
      ...context.candidateTargets.map((target) => target.website),
      ...artifacts.searchEvidence.flatMap((evidence) =>
        evidence.results.map((result) => result.url),
      ),
    ].filter((url): url is string => url !== null),
  );
}

export function finalizeEntityClassification({
  context,
  advice,
  artifacts,
}: {
  context: EntityClassificationContext;
  advice: EntityClassificationAdvice;
  artifacts: EntityClassificationArtifacts;
}): EntityClassificationAdvice {
  const knownEvidenceUrls = getKnownEvidenceUrls(context, artifacts);
  const reviewedAdvice = {
    ...advice,
    evidenceUrls: advice.evidenceUrls.filter((url) =>
      knownEvidenceUrls.has(url),
    ),
  };

  if (
    reviewedAdvice.kind === "brand_assignment_issue" ||
    reviewedAdvice.kind === "possible_duplicate"
  ) {
    if (reviewedAdvice.targetEntityId === null) {
      return insufficientEvidenceAdvice({
        advice: reviewedAdvice,
        reason: "The advice did not identify a target Entity.",
      });
    }

    if (
      !isKnownTarget({
        targetEntityId: reviewedAdvice.targetEntityId,
        context,
        artifacts,
      })
    ) {
      return insufficientEvidenceAdvice({
        advice: reviewedAdvice,
        reason: `Target Entity ${reviewedAdvice.targetEntityId} was not present in local evidence.`,
      });
    }

    return reviewedAdvice;
  }

  if (
    reviewedAdvice.kind === "metadata_issue" &&
    reviewedAdvice.evidenceUrls.length === 0
  ) {
    return insufficientEvidenceAdvice({
      advice: reviewedAdvice,
      reason: "Metadata advice requires an authoritative evidence URL.",
    });
  }

  return {
    ...reviewedAdvice,
    targetEntityId: null,
  };
}
