import {
  isIgnoredBottleClassification,
  type BottleClassificationResult,
  type BottleReferenceInput,
  type ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier";
import type {
  BottleClassificationDecision,
  BottleConfidenceBasis,
  BottleObservation,
} from "@peated/bottle-classifier/internal/types";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import { classifyScrapedBottleReference } from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import config from "@peated/server/config";
import { db, type AnyTransaction } from "@peated/server/db";
import { externalReviews } from "@peated/server/db/schema";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import type { BottleReferenceIdentitySnapshot } from "@peated/server/lib/bottleReferences";
import {
  createOrReuseBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import { logTelemetryError } from "@peated/server/lib/log";
import { eq } from "drizzle-orm";
import { assessBottleResolution } from "./bottleMatchingAutomation";
import {
  assertExpectedReviewIdentity,
  assignBottleReferenceInTransaction,
  type BottleReferenceAssignmentInput,
} from "./bottleReferences";
import { buildClassifierBottleInput } from "./classifierDecisionCreateInputs";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "./resolveActiveBottleIds";

export type BottleReferenceResolutionSource =
  | "exact_reference"
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
  sourceReferenceIdentity?: BottleReferenceIdentitySnapshot;
  // Present whenever the classifier ran, so the caller can save the run.
  classification?: ReferenceClassificationRun;
};

export type ReferenceClassificationRun = {
  input: ClassifyBottleReferenceInput;
  result: BottleClassificationResult;
};

/** A source-only classifier match must never become a reusable name assertion. */
export async function assignReviewBottleResolutionInTransaction(
  tx: AnyTransaction,
  resolution: BottleReferenceResolution,
  input: BottleReferenceAssignmentInput & {
    expectedReview: NonNullable<
      BottleReferenceAssignmentInput["expectedReview"]
    >;
  },
) {
  const classification = resolution.classification?.result;
  if (
    resolution.source === "exact_reference" ||
    (classification?.status === "classified" &&
      classification.decision.referenceScope === "global_alias")
  ) {
    const result = await assignBottleReferenceInTransaction(tx, {
      ...input,
      sourceReferenceIdentity: resolution.sourceReferenceIdentity,
    });
    await tx
      .update(externalReviews)
      .set({ matchedReferenceId: result.referenceId })
      .where(eq(externalReviews.id, input.expectedReview.id));
    return result;
  }
  await resolveActiveBottleIds(tx, [input.bottleId], { lock: "update" });
  await assertExpectedReviewIdentity(tx, input.expectedReview);
  await tx
    .update(externalReviews)
    .set({
      bottleId: input.bottleId,
      matchedReferenceId: null,
      bottleNoMatchAt: null,
    })
    .where(eq(externalReviews.id, input.expectedReview.id));
  return null;
}

/**
 * Saves a review's classifier run as a Bottle check so the exact input,
 * candidates, and evidence can be replayed as an eval test case later.
 *
 * Best effort: the review does not depend on this record, so call it after the
 * review is saved. A failure is logged with the review id and never thrown.
 */
export async function persistReviewBottleCheck({
  reviewId,
  classification,
}: {
  reviewId: number;
  classification: ReferenceClassificationRun;
}) {
  try {
    await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "review",
      sourceId: reviewId,
      input: classification.input,
      result: classification.result,
      model: config.BOTTLE_CLASSIFIER_MODEL,
    });
  } catch (error) {
    logTelemetryError(error, { extra: { reviewId } });
  }
}

/** Locks the resolved Bottle before any reference or consumer row is locked. */
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
  createdByActorId,
}: {
  decision: ClassifierCreateDecision;
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
 * Resolve a raw external Bottle Reference into Bottle identity. Exact references
 * retain their accepted fast path; ambiguous references use the reviewed
 * classifier. `create_bottle` returns the created or reused Bottle.
 *
 * Classifier and creation failures return unresolved results so ingestion can
 * preserve its raw source record.
 */
type ResolveBottleReferenceTargetInput = {
  reference: BottleReferenceInput;
  referenceLookupNames?: string[];
  createdByActorId: number;
  allowReplacement?: boolean;
};

async function resolveBottleReferenceTargetWithClassifier(
  {
    reference,
    referenceLookupNames = [],
    createdByActorId,
    allowReplacement,
  }: ResolveBottleReferenceTargetInput,
  classify: typeof classifyBottleReference,
): Promise<BottleReferenceResolution> {
  const uniqueReferenceLookupNames = Array.from(
    new Set(referenceLookupNames.map((name) => name.trim()).filter(Boolean)),
  );

  for (const referenceName of uniqueReferenceLookupNames) {
    const match = await findBottleReferenceAssignment(referenceName);
    if (match) {
      return {
        assignment: {
          kind: "direct_bottle",
          bottleId: match.bottleId,
        },
        source: "exact_reference",
        error: null,
        confidence: null,
        model: null,
        rationale: null,
        classifierEvidence: null,
        createdBottle: false,
        sourceReferenceIdentity: match.reference,
      };
    }
  }

  let classification: BottleClassificationResult;
  // Source titles carry no structured facts. Supplying an extracted identity
  // here, even an empty one, would make the classifier skip text extraction.
  const classificationInput: ClassifyBottleReferenceInput = { reference };
  try {
    classification = await classify(classificationInput);
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

  const classificationRun = {
    input: classificationInput,
    result: classification,
  };

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
      classification: classificationRun,
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
      classification.decision.action === "no_match" ||
      !assessBottleResolution({
        decision: classification.decision,
        candidates: classification.artifacts.candidates,
        currentBottleId: reference.currentBottleId ?? null,
        allowReplacement,
        sourceBottleIdentity:
          classification.artifacts.extractedIdentitySource === "image"
            ? classification.artifacts.extractedIdentity
            : null,
        readListingImage:
          classification.artifacts.extractedIdentitySource === "image",
      }).automationEligible
    ) {
      return {
        assignment: null,
        source: "unresolved",
        error: null,
        confidence: decisionConfidence,
        model: config.BOTTLE_CLASSIFIER_MODEL,
        rationale: decisionRationale,
        classifierEvidence,
        createdBottle: false,
        classification: classificationRun,
      };
    }

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
        classification: classificationRun,
      };
    }

    const result = await applyClassifierCreateDecision({
      decision: classification.decision,
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
      classification: classificationRun,
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
      classification: classificationRun,
    };
  }
}

export async function resolveBottleReferenceTarget(
  input: ResolveBottleReferenceTargetInput,
  classify: typeof classifyBottleReference = classifyBottleReference,
) {
  return await resolveBottleReferenceTargetWithClassifier(input, classify);
}

/** External scraper ingestion uses the scraper classifier credential policy. */
export async function resolveScrapedBottleReferenceTarget(
  input: ResolveBottleReferenceTargetInput,
  classify: typeof classifyScrapedBottleReference = classifyScrapedBottleReference,
) {
  return await resolveBottleReferenceTargetWithClassifier(input, classify);
}
