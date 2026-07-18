import {
  isIgnoredBottleClassification,
  type BottleClassificationResult,
  type BottleReference,
} from "@peated/bottle-classifier";
import type {
  BottleClassificationDecision,
  BottleConfidenceBasis,
  BottleExtractedDetails,
  BottleIdentityBasis,
  BottleObservation,
} from "@peated/bottle-classifier/internal/types";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import config from "@peated/server/config";
import { db, type AnyTransaction } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import {
  CatalogTargetResolutionError,
  getStagedTargetlessCatalogMappingReason,
  lockCatalogTargetConsumerAssignmentInTransaction,
  lockStagedTargetlessCatalogAssignmentInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
  type CatalogTargetConsumerAssignment,
  type CatalogTargetOperationContext,
  type StagedTargetlessCatalogAssignment,
} from "@peated/server/lib/catalogTargets";
import {
  createOrReuseConcreteBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import { buildClassifierConcreteBottleInput } from "./classifierDecisionCreateInputs";

export type BottleReferenceResolutionSource =
  | "exact_alias"
  | "classifier_match"
  | "classifier_create_bottle"
  | "unresolved";

export type BottleReferenceClassifierEvidence = {
  action: BottleClassificationDecision["action"];
  parentBottleId: number | null;
  identityScope: BottleClassificationDecision["identityScope"] | null;
  observation: BottleObservation | null;
  identityBasis: BottleIdentityBasis | null;
  confidenceBasis: BottleConfidenceBasis | null;
};

export type BottleReferenceResolution = {
  assignment:
    | ({ kind: "target" } & CatalogTargetConsumerAssignment)
    | {
        kind: "staged_targetless";
        stagedTargetless: StagedTargetlessCatalogAssignment;
        consumerIdentity: { bottleId: number; releaseId: number | null };
      }
    | null;
  source: BottleReferenceResolutionSource;
  error: Error | null;
  confidence: number | null;
  model: string | null;
  rationale: string | null;
  classifierEvidence: BottleReferenceClassifierEvidence | null;
  createdBottle: boolean;
};

/** Locks the complete target/projection decision before a consumer persists it. */
export async function lockBottleReferenceResolutionAssignmentInTransaction(
  tx: AnyTransaction,
  resolution: BottleReferenceResolution,
  context: CatalogTargetOperationContext,
) {
  const assignment = resolution.assignment;
  if (!assignment) return null;

  if (assignment.kind === "target") {
    await lockCatalogTargetConsumerAssignmentInTransaction(
      tx,
      assignment,
      context,
    );
    return assignment;
  }

  if (
    assignment.consumerIdentity.bottleId !==
      assignment.stagedTargetless.bottleId ||
    assignment.consumerIdentity.releaseId !==
      assignment.stagedTargetless.releaseId
  ) {
    throw new Error(
      "Staged Bottle resolution projection does not match its compatibility decision.",
    );
  }
  await lockStagedTargetlessCatalogAssignmentInTransaction(
    tx,
    assignment.stagedTargetless,
  );
  return assignment;
}

type ClassifierCreateDecision = Extract<
  BottleClassificationDecision,
  { action: "create_bottle" }
>;

function projectClassifierEvidence(
  decision: BottleClassificationDecision,
): BottleReferenceClassifierEvidence {
  return {
    action: decision.action,
    parentBottleId: null,
    identityScope: decision.identityScope ?? null,
    observation: decision.observation ?? null,
    identityBasis: decision.identityBasis ?? null,
    confidenceBasis: decision.confidenceBasis ?? null,
  };
}

function getKnownCandidateBottleIds(
  classification: BottleClassificationResult,
): Set<number> {
  return new Set(
    classification.artifacts.candidates.map((candidate) => candidate.bottleId),
  );
}

function getKnownCandidateReleaseIds(
  classification: BottleClassificationResult,
): Set<number> {
  return new Set(
    classification.artifacts.candidates
      .map((candidate) => candidate.releaseId ?? null)
      .filter((releaseId): releaseId is number => releaseId !== null),
  );
}

/** The reviewed classifier may match or reuse only candidates it was shown. */
function assertKnownClassifierTarget(
  decision: BottleClassificationDecision,
  classification: BottleClassificationResult,
) {
  const candidateBottleIds = getKnownCandidateBottleIds(classification);
  const candidateReleaseIds = getKnownCandidateReleaseIds(classification);

  if (
    (decision.action === "match" || decision.action === "repair_bottle") &&
    !candidateBottleIds.has(decision.matchedBottleId)
  ) {
    throw new Error(
      `Classifier returned unknown matched bottle id (${decision.matchedBottleId}).`,
    );
  }

  if (
    decision.action === "match" &&
    decision.matchedReleaseId !== null &&
    !candidateReleaseIds.has(decision.matchedReleaseId)
  ) {
    throw new Error(
      `Classifier returned unknown matched release id (${decision.matchedReleaseId}).`,
    );
  }
}

/**
 * Creates one complete concrete Bottle in a singleton group. A verified exact
 * duplicate reuses its existing Bottle and target instead of creating a group.
 */
export async function applyClassifierCreateDecision({
  decision,
  user,
  createdByActorId,
}: {
  decision: ClassifierCreateDecision;
  user: User;
  createdByActorId: number;
}): Promise<{
  bottleId: number;
  releaseId: null;
  targetId: number;
  createdBottle: boolean;
  assignment: { kind: "target" } & CatalogTargetConsumerAssignment;
}> {
  const input = buildClassifierConcreteBottleInput(decision.proposedBottle);
  const result = await db.transaction(async (tx) =>
    createOrReuseConcreteBottleInTransaction(tx, {
      creationSource: "bottle_classifier",
      createdByActorId,
      input,
      context: { user },
    }),
  );

  if (result.createResult) {
    await finalizeCreatedBottle(result.createResult, {
      creationSource: "bottle_classifier",
    });
  }

  return {
    bottleId: result.bottle.id,
    releaseId: null,
    targetId: result.target.targetId,
    assignment: {
      kind: "target",
      target: result.target,
      consumerIdentity: { bottleId: result.bottle.id, releaseId: null },
    },
    createdBottle: result.createResult !== null,
  };
}

/**
 * Resolve a raw external bottle reference into catalog identity. Exact aliases
 * retain their accepted fast path; ambiguous references use the reviewed
 * classifier. `create_bottle` returns its canonical exact target and the
 * concrete creation source.
 *
 * Classifier and creation failures return unresolved results so ingestion can
 * preserve its raw source record. CatalogTarget boundary failures remain
 * visible; only the two explicit staged-migration states may stay targetless.
 */
export async function resolveBottleReferenceTarget({
  reference,
  aliasLookupNames = [],
  extractedIdentity = null,
  user,
  createdByActorId,
}: {
  reference: BottleReference;
  aliasLookupNames?: string[];
  extractedIdentity?: Partial<BottleExtractedDetails> | null;
  user: User;
  createdByActorId: number;
}): Promise<BottleReferenceResolution> {
  const uniqueAliasLookupNames = Array.from(
    new Set(aliasLookupNames.map((name) => name.trim()).filter(Boolean)),
  );

  for (const aliasName of uniqueAliasLookupNames) {
    const match = await findBottleAliasAssignment(aliasName, {
      caller: "bottleReferenceResolution",
      operation: "resolveBottleReferenceTarget",
    });
    if (match?.kind === "target" && match.consumerIdentity.bottleId !== null) {
      return {
        assignment: {
          kind: "target",
          target: match.target,
          consumerIdentity: match.consumerIdentity,
        },
        source: "exact_alias",
        error: null,
        confidence: null,
        model: null,
        rationale: null,
        classifierEvidence: null,
        createdBottle: false,
      };
    }
    if (match?.kind === "staged_targetless") {
      return {
        assignment: {
          kind: "staged_targetless",
          stagedTargetless: match.stagedTargetless,
          consumerIdentity: match.consumerIdentity,
        },
        source: "exact_alias",
        error: null,
        confidence: null,
        model: null,
        rationale: null,
        classifierEvidence: null,
        createdBottle: false,
      };
    }
  }

  let classification: BottleClassificationResult;
  try {
    classification = await classifyBottleReference({
      reference,
      extractedIdentity: extractedIdentity
        ? {
            brand: null,
            bottler: null,
            expression: null,
            series: null,
            distillery: null,
            category: null,
            stated_age: null,
            abv: null,
            release_year: null,
            vintage_year: null,
            cask_strength: null,
            single_cask: null,
            edition: null,
            ...extractedIdentity,
          }
        : null,
    });
  } catch (error) {
    return {
      assignment: null,
      source: "unresolved",
      error: error instanceof Error ? error : new Error("Classifier failed."),
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      classifierEvidence: null,
      createdBottle: false,
    };
  }

  if (isIgnoredBottleClassification(classification)) {
    return {
      assignment: null,
      source: "unresolved",
      error: null,
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      classifierEvidence: null,
      createdBottle: false,
    };
  }

  try {
    assertKnownClassifierTarget(classification.decision, classification);
    const decisionConfidence = null;
    const decisionRationale = classification.decision.rationale ?? null;
    const classifierEvidence = projectClassifierEvidence(
      classification.decision,
    );

    if (
      classification.decision.action === "match" ||
      classification.decision.action === "repair_bottle"
    ) {
      const bottleId = classification.decision.matchedBottleId;
      const releaseId =
        classification.decision.action === "match"
          ? classification.decision.matchedReleaseId
          : null;
      let target: CatalogTargetAssignmentDescriptor | null = null;
      let stagedTargetless: StagedTargetlessCatalogAssignment | null = null;
      try {
        target = await resolveCatalogTargetForAssignment({
          kind: "legacy",
          bottleId,
          releaseId,
          context: {
            caller: "bottleReferenceResolution",
            operation: "applyClassifierMatch",
          },
        });
      } catch (error) {
        const stagedReason = getStagedTargetlessCatalogMappingReason(error);
        if (!stagedReason) throw error;
        stagedTargetless = { bottleId, releaseId, stagedReason };
      }
      return {
        assignment: target
          ? {
              kind: "target",
              target,
              consumerIdentity: { bottleId, releaseId },
            }
          : {
              kind: "staged_targetless",
              stagedTargetless: stagedTargetless!,
              consumerIdentity: { bottleId, releaseId },
            },
        source: "classifier_match",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        classifierEvidence,
        createdBottle: false,
      };
    }

    if (classification.decision.action === "no_match") {
      return {
        assignment: null,
        source: "unresolved",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        classifierEvidence,
        createdBottle: false,
      };
    }

    const result = await applyClassifierCreateDecision({
      decision: classification.decision,
      user,
      createdByActorId,
    });
    return {
      assignment: result.assignment,
      source: "classifier_create_bottle",
      error: null,
      confidence: decisionConfidence,
      model: config.OPENAI_MODEL,
      rationale: decisionRationale,
      classifierEvidence,
      createdBottle: result.createdBottle,
    };
  } catch (error) {
    if (error instanceof CatalogTargetResolutionError) throw error;
    return {
      assignment: null,
      source: "unresolved",
      error:
        error instanceof Error
          ? error
          : new Error("Failed to apply classifier decision."),
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      classifierEvidence: null,
      createdBottle: false,
    };
  }
}
