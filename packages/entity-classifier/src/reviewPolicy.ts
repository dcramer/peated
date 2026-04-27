import type {
  EntityClassificationCandidateTarget,
  EntityClassificationDecision,
  EntityClassificationReference,
  EntityResolution,
} from "./classifierTypes";
import type { EntityClassificationArtifacts } from "./contract";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function getTargetName(
  target:
    | EntityClassificationCandidateTarget
    | EntityResolution
    | null
    | undefined,
) {
  return target?.name ?? null;
}

function appendBlockers(
  decision: EntityClassificationDecision,
  blockers: string[],
) {
  return uniqueStrings([...decision.blockers, ...blockers]);
}

function manualReviewDecision({
  decision,
  blockers,
}: {
  decision: EntityClassificationDecision;
  blockers: string[];
}): EntityClassificationDecision {
  return {
    ...decision,
    verdict: "manual_review",
    confidence: Math.min(decision.confidence, 60),
    targetEntityId: null,
    targetEntityName: null,
    reassignBottleIds: [],
    preserveSourceAsDistillery: false,
    metadataPatch: {},
    blockers: appendBlockers(decision, blockers),
  };
}

function findKnownTarget({
  targetEntityId,
  reference,
  artifacts,
}: {
  targetEntityId: number | null;
  reference: EntityClassificationReference;
  artifacts: EntityClassificationArtifacts;
}) {
  if (targetEntityId === null) {
    return {
      candidateTarget: null,
      resolvedEntity: null,
    };
  }

  return {
    candidateTarget:
      reference.candidateTargets.find(
        (target) => target.entityId === targetEntityId,
      ) ?? null,
    resolvedEntity:
      artifacts.resolvedEntities.find(
        (entity) => entity.entityId === targetEntityId,
      ) ?? null,
  };
}

function hasMetadataPatch(decision: EntityClassificationDecision) {
  return Object.keys(decision.metadataPatch).length > 0;
}

export function finalizeEntityClassification({
  reference,
  decision,
  artifacts,
}: {
  reference: EntityClassificationReference;
  decision: EntityClassificationDecision;
  artifacts: EntityClassificationArtifacts;
}): EntityClassificationDecision {
  if (decision.verdict === "reassign_bottles_to_existing_brand") {
    if (decision.targetEntityId === null) {
      return manualReviewDecision({
        decision,
        blockers: [
          "Server downgraded reassignment because no target entity id was returned.",
        ],
      });
    }

    const { candidateTarget, resolvedEntity } = findKnownTarget({
      targetEntityId: decision.targetEntityId,
      reference,
      artifacts,
    });
    const knownTarget = candidateTarget ?? resolvedEntity;
    if (!knownTarget) {
      return manualReviewDecision({
        decision,
        blockers: [
          `Server downgraded reassignment because target entity ${decision.targetEntityId} was not present in local candidates or resolved entities.`,
        ],
      });
    }

    const supportedBottleIds = new Set(
      candidateTarget?.supportingBottleIds ?? [],
    );
    const reassignBottleIds = decision.reassignBottleIds.filter((bottleId) =>
      supportedBottleIds.has(bottleId),
    );
    const blockers: string[] = [];

    if (reassignBottleIds.length !== decision.reassignBottleIds.length) {
      blockers.push(
        "Server removed reassignment bottle ids that were not in grouped local evidence.",
      );
    }

    if (reassignBottleIds.length === 0) {
      return manualReviewDecision({
        decision: {
          ...decision,
          targetEntityName: getTargetName(knownTarget),
          blockers: appendBlockers(decision, blockers),
        },
        blockers: [
          "Server downgraded reassignment because no returned bottle ids were supported by grouped local evidence.",
        ],
      });
    }

    return {
      ...decision,
      targetEntityName: getTargetName(knownTarget),
      reassignBottleIds,
      metadataPatch: {},
      blockers: appendBlockers(decision, blockers),
    };
  }

  if (decision.verdict === "possible_duplicate_entity") {
    if (decision.targetEntityId === null) {
      return decision;
    }

    const { candidateTarget, resolvedEntity } = findKnownTarget({
      targetEntityId: decision.targetEntityId,
      reference,
      artifacts,
    });
    const knownTarget = candidateTarget ?? resolvedEntity;
    if (!knownTarget) {
      return manualReviewDecision({
        decision,
        blockers: [
          `Server downgraded duplicate decision because target entity ${decision.targetEntityId} was not present in local candidates or resolved entities.`,
        ],
      });
    }

    return {
      ...decision,
      targetEntityName: getTargetName(knownTarget),
      reassignBottleIds: [],
      preserveSourceAsDistillery: false,
      metadataPatch: {},
    };
  }

  if (decision.verdict === "fix_entity_metadata") {
    if (hasMetadataPatch(decision) && decision.evidenceUrls.length === 0) {
      return manualReviewDecision({
        decision,
        blockers: [
          "Server downgraded metadata fix because no authoritative evidence URL was returned.",
        ],
      });
    }

    return {
      ...decision,
      targetEntityId: null,
      targetEntityName: null,
      reassignBottleIds: [],
      preserveSourceAsDistillery: false,
    };
  }

  return {
    ...decision,
    targetEntityId: null,
    targetEntityName: null,
    reassignBottleIds: [],
    preserveSourceAsDistillery: false,
    metadataPatch: {},
  };
}
