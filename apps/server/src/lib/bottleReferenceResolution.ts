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
import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { bottles } from "@peated/server/db/schema";
import { findBottleTarget } from "@peated/server/lib/bottleFinder";
import {
  lockCatalogTargetAssignmentDescriptorInTransaction,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
} from "@peated/server/lib/catalogTargets";
import {
  BottleAlreadyExistsError,
  createConcreteBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import { eq } from "drizzle-orm";
import { buildClassifierConcreteBottleInput } from "./classifierDecisionCreateInputs";

export type BottleReferenceResolutionSource =
  | "exact_alias"
  | "classifier_match"
  | "classifier_create_bottle"
  | "classifier_create_release"
  | "classifier_create_bottle_and_release"
  | "classifier_repair_parent_and_create_release"
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
  bottleId: number | null;
  releaseId: number | null;
  targetId: number | null;
  source: BottleReferenceResolutionSource;
  error: Error | null;
  confidence: number | null;
  model: string | null;
  rationale: string | null;
  classifierEvidence: BottleReferenceClassifierEvidence | null;
  createdBottle: boolean;
  createdRelease: boolean;
};

type ClassifierCreateDecision = Extract<
  BottleClassificationDecision,
  {
    action:
      | "create_bottle"
      | "create_release"
      | "create_bottle_and_release"
      | "repair_parent_and_create_release";
  }
>;

function projectClassifierEvidence(
  decision: BottleClassificationDecision,
): BottleReferenceClassifierEvidence {
  return {
    action: decision.action,
    parentBottleId: decision.parentBottleId ?? null,
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

  if (
    (decision.action === "create_release" ||
      decision.action === "repair_parent_and_create_release") &&
    !candidateBottleIds.has(decision.parentBottleId)
  ) {
    throw new Error(
      `Classifier returned unknown parent bottle id (${decision.parentBottleId}).`,
    );
  }
}

function getDecisionSmwsCode(decision: ClassifierCreateDecision) {
  if (decision.identityScope !== "exact_cask" || !decision.proposedBottle) {
    return null;
  }
  return (
    parseSmwsReferenceName(`SMWS ${decision.proposedBottle.name}`)?.code ??
    (decision.observation?.caskNumber
      ? parseSmwsReferenceName(`SMWS ${decision.observation.caskNumber}`)?.code
      : null) ??
    null
  );
}

function isSafeClassifierDuplicate({
  decision,
  error,
  existingBottle,
}: {
  decision: ClassifierCreateDecision;
  error: BottleAlreadyExistsError;
  existingBottle: typeof bottles.$inferSelect;
}) {
  if (
    error.collision?.kind === "canonical_name" &&
    error.collision.attemptedCanonicalFullName !== null
  ) {
    return (
      existingBottle.fullName === error.collision.attemptedCanonicalFullName
    );
  }

  if (error.collision?.kind !== "smws_code") return false;
  const decisionCode = getDecisionSmwsCode(decision);
  if (!decisionCode) return false;
  return [existingBottle.name, existingBottle.fullName].some(
    (name) => parseSmwsReferenceName(name)?.code === decisionCode,
  );
}

/**
 * Persists every create-shaped classifier action as one complete concrete
 * Bottle. Legacy action names remain evidence and never select BottleRelease
 * storage or authorize mutation of a trusted source Bottle.
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
  createdRelease: false;
}> {
  const input = buildClassifierConcreteBottleInput(decision);
  const result = await db.transaction(async (tx) => {
    let created: Awaited<
      ReturnType<typeof createConcreteBottleInTransaction>
    > | null = null;
    let target: CatalogTargetAssignmentDescriptor;
    let bottle: typeof bottles.$inferSelect;

    try {
      // Duplicate preparation may create entities or a group prefix. Keep it in
      // a savepoint so reuse starts from a clean transaction state.
      created = await tx.transaction(async (creationTx) =>
        createConcreteBottleInTransaction(creationTx, {
          creationSource: "bottle_classifier",
          createdByActorId,
          input,
          context: { user },
        }),
      );
      bottle = created.bottle;
      target = {
        targetId: created.exactTarget.id,
        groupId: created.group.id,
        bottleId: created.bottle.id,
      };
    } catch (error) {
      if (!(error instanceof BottleAlreadyExistsError)) throw error;

      const existingTarget = await resolveCatalogTargetForAssignment(
        { kind: "bottle", bottleId: error.bottleId },
        tx,
      );
      if (input.kind === "source_bottle") {
        const sourceTarget = await resolveCatalogTargetForAssignment(
          { kind: "bottle", bottleId: input.sourceBottleId },
          tx,
        );
        await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
          sourceTarget,
          existingTarget,
        ]);
        if (sourceTarget.groupId !== existingTarget.groupId) throw error;
      } else {
        await lockCatalogTargetAssignmentDescriptorInTransaction(
          tx,
          existingTarget,
          { composition: "concrete_bottle_mutation" },
        );
      }

      const existingBottle = await tx.query.bottles.findFirst({
        where: eq(bottles.id, error.bottleId),
      });
      if (
        !existingBottle ||
        !isSafeClassifierDuplicate({ decision, error, existingBottle })
      ) {
        throw error;
      }
      bottle = existingBottle;
      target = existingTarget;
    }

    return { bottle, created, target };
  });

  if (result.created) {
    await finalizeCreatedBottle(result.created, {
      creationSource: "bottle_classifier",
    });
  }

  return {
    bottleId: result.bottle.id,
    releaseId: null,
    targetId: result.target.targetId,
    createdBottle: result.created !== null,
    createdRelease: false,
  };
}

/**
 * Resolve a raw external bottle reference into catalog identity. Exact aliases
 * retain their accepted fast path; ambiguous references use the reviewed
 * classifier. Create-shaped actions return their canonical exact target while
 * retaining the original classifier action in `source`.
 *
 * Errors are returned as unresolved results so ingestion can preserve its raw
 * source record when classification or persistence fails.
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
    const target = await findBottleTarget(aliasName, {
      caller: "bottleReferenceResolution",
      operation: "resolveBottleReferenceTarget",
    });
    if (target) {
      return {
        bottleId: target.bottleId,
        releaseId: target.releaseId,
        targetId: target.targetId,
        source: "exact_alias",
        error: null,
        confidence: null,
        model: null,
        rationale: null,
        classifierEvidence: null,
        createdBottle: false,
        createdRelease: false,
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
      bottleId: null,
      releaseId: null,
      targetId: null,
      source: "unresolved",
      error: error instanceof Error ? error : new Error("Classifier failed."),
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      classifierEvidence: null,
      createdBottle: false,
      createdRelease: false,
    };
  }

  if (isIgnoredBottleClassification(classification)) {
    return {
      bottleId: null,
      releaseId: null,
      targetId: null,
      source: "unresolved",
      error: null,
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      classifierEvidence: null,
      createdBottle: false,
      createdRelease: false,
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
      return {
        bottleId: classification.decision.matchedBottleId,
        releaseId:
          classification.decision.action === "match"
            ? classification.decision.matchedReleaseId
            : null,
        targetId: null,
        source: "classifier_match",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        classifierEvidence,
        createdBottle: false,
        createdRelease: false,
      };
    }

    if (classification.decision.action === "no_match") {
      return {
        bottleId: null,
        releaseId: null,
        targetId: null,
        source: "unresolved",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        classifierEvidence,
        createdBottle: false,
        createdRelease: false,
      };
    }

    const result = await applyClassifierCreateDecision({
      decision: classification.decision,
      user,
      createdByActorId,
    });
    const source: BottleReferenceResolutionSource =
      classification.decision.action === "create_bottle"
        ? "classifier_create_bottle"
        : classification.decision.action === "create_release"
          ? "classifier_create_release"
          : classification.decision.action === "create_bottle_and_release"
            ? "classifier_create_bottle_and_release"
            : "classifier_repair_parent_and_create_release";

    return {
      ...result,
      source,
      error: null,
      confidence: decisionConfidence,
      model: config.OPENAI_MODEL,
      rationale: decisionRationale,
      classifierEvidence,
    };
  } catch (error) {
    return {
      bottleId: null,
      releaseId: null,
      targetId: null,
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
      createdRelease: false,
    };
  }
}
