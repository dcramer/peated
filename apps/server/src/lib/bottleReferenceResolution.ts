import {
  isIgnoredBottleClassification,
  type BottleClassificationResult,
  type BottleReference,
} from "@peated/bottle-classifier";
import type {
  BottleClassificationDecision,
  BottleConfidenceBasis,
  BottleExtractedDetails,
  BottleObservation,
} from "@peated/bottle-classifier/internal/types";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import config from "@peated/server/config";
import { db, type AnyTransaction } from "@peated/server/db";
import { type User } from "@peated/server/db/schema";
import type { BottleAliasIdentitySnapshot } from "@peated/server/lib/bottleAliases";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import {
  createOrReuseBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import { buildClassifierBottleInput } from "./classifierDecisionCreateInputs";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "./resolveActiveBottleIds";

export type BottleReferenceResolutionSource =
  | "exact_alias"
  | "classifier_match"
  | "classifier_create_bottle"
  | "unresolved";

export type BottleReferenceClassifierEvidence = {
  action: BottleClassificationDecision["action"];
  identityScope: BottleClassificationDecision["identityScope"] | null;
  observation: BottleObservation | null;
  confidenceBasis: BottleConfidenceBasis | null;
};

export type BottleReferenceAssignment = {
  kind: "direct_bottle";
  bottleId: number;
};

export type BottleReferenceResolution = {
  assignment: BottleReferenceAssignment | null;
  source: BottleReferenceResolutionSource;
  error: Error | null;
  confidence: number | null;
  model: string | null;
  rationale: string | null;
  classifierEvidence: BottleReferenceClassifierEvidence | null;
  createdBottle: boolean;
  sourceAliasIdentity?: BottleAliasIdentitySnapshot;
};

/** Locks the resolved Bottle before any alias or consumer row is locked. */
export async function lockBottleReferenceResolutionAssignmentInTransaction(
  tx: AnyTransaction,
  resolution: BottleReferenceResolution,
  context: { caller: string; operation: string },
) {
  const assignment = resolution.assignment;
  if (!assignment) return null;

  const { bottleId } = assignment;
  try {
    await resolveActiveBottleIds(tx, [bottleId], { lock: "update" });
  } catch (error) {
    if (!(error instanceof ActiveBottleSelectionError)) throw error;
    throw new Error(
      error.reason === "missing"
        ? `Bottle ${bottleId} does not exist while ${context.caller}.${context.operation} is persisting its assignment.`
        : error.reason === "bottle_retired"
          ? `Bottle ${bottleId} is retired.`
          : `Bottle ${bottleId} is not active while ${context.caller}.${context.operation} is persisting its assignment (${error.reason}).`,
      { cause: error },
    );
  }
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
    identityScope: decision.identityScope ?? null,
    observation: decision.observation ?? null,
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

/** The reviewed classifier may assign only a Bottle candidate it was shown. */
function assertKnownClassifierTarget(
  decision: BottleClassificationDecision,
  classification: BottleClassificationResult,
) {
  const candidateBottleIds = getKnownCandidateBottleIds(classification);

  if (
    decision.action === "match" &&
    !candidateBottleIds.has(decision.matchedBottleId)
  ) {
    throw new Error(
      `Classifier returned unknown matched bottle id (${decision.matchedBottleId}).`,
    );
  }
}

/**
 * Creates one complete Bottle in a singleton group. A verified exact
 * duplicate reuses its existing Bottle instead of creating a group.
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
  createdBottle: boolean;
  assignment: BottleReferenceAssignment;
}> {
  const input = buildClassifierBottleInput(decision.proposedBottle);
  const result = await db.transaction(async (tx) =>
    createOrReuseBottleInTransaction(tx, {
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
    assignment: {
      kind: "direct_bottle",
      bottleId: result.bottle.id,
    },
    createdBottle: result.createResult !== null,
  };
}

/**
 * Resolve a raw external Bottle Reference into Bottle identity. Exact aliases
 * retain their accepted fast path; ambiguous references use the reviewed
 * classifier. `create_bottle` returns the created or reused Bottle.
 *
 * Classifier and creation failures return unresolved results so ingestion can
 * preserve its raw source record.
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
    const match = await findBottleAliasAssignment(aliasName);
    if (match) {
      return {
        assignment: {
          kind: "direct_bottle",
          bottleId: match.bottleId,
        },
        source: "exact_alias",
        error: null,
        confidence: null,
        model: null,
        rationale: null,
        classifierEvidence: null,
        createdBottle: false,
        sourceAliasIdentity: match.alias,
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
            cask_type: null,
            cask_size: null,
            cask_fill: null,
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
      model: config.BOTTLE_CLASSIFIER_MODEL,
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
      model: config.BOTTLE_CLASSIFIER_MODEL,
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

    if (classification.decision.action === "match") {
      const bottleId = classification.decision.matchedBottleId;
      return {
        assignment: {
          kind: "direct_bottle",
          bottleId,
        },
        source: "classifier_match",
        error: null,
        confidence: decisionConfidence,
        model: config.BOTTLE_CLASSIFIER_MODEL,
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
        model: config.BOTTLE_CLASSIFIER_MODEL,
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
      model: config.BOTTLE_CLASSIFIER_MODEL,
      rationale: decisionRationale,
      classifierEvidence,
      createdBottle: result.createdBottle,
    };
  } catch (error) {
    return {
      assignment: null,
      source: "unresolved",
      error:
        error instanceof Error
          ? error
          : new Error("Failed to apply classifier decision."),
      confidence: null,
      model: config.BOTTLE_CLASSIFIER_MODEL,
      rationale: null,
      classifierEvidence: null,
      createdBottle: false,
    };
  }
}
