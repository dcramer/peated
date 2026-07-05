import {
  isIgnoredBottleClassification,
  type BottleClassificationResult,
  type BottleReference,
} from "@peated/bottle-classifier";
import type {
  BottleClassificationDecision,
  BottleExtractedDetails,
} from "@peated/bottle-classifier/internal/types";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import type { BottleRelease, User } from "@peated/server/db/schema";
import { bottleReleases } from "@peated/server/db/schema";
import { findBottleTarget } from "@peated/server/lib/bottleFinder";
import {
  BottleAlreadyExistsError,
  createBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  BottleReleaseAlreadyExistsError,
  createBottleReleaseInTransaction,
  finalizeCreatedBottleRelease,
} from "@peated/server/lib/createBottleRelease";
import { normalizeIncomingBottleDecisionConfidence } from "@peated/server/lib/incomingBottleDecisionLog";
import { and, eq } from "drizzle-orm";
import { buildClassifierCreateInputs } from "./classifierDecisionCreateInputs";

export type BottleReferenceResolutionSource =
  | "exact_alias"
  | "classifier_match"
  | "classifier_create_bottle"
  | "classifier_create_release"
  | "classifier_create_bottle_and_release"
  | "unresolved";

export type BottleReferenceResolution = {
  bottleId: number | null;
  releaseId: number | null;
  source: BottleReferenceResolutionSource;
  error: Error | null;
  confidence: number | null;
  model: string | null;
  rationale: string | null;
  createdBottle: boolean;
  createdRelease: boolean;
};

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

/**
 * The reviewed classifier may match or reuse only candidates it was shown.
 * Keeping this adapter check local prevents ingestion jobs from silently
 * trusting stale or malformed ids if the classifier/runtime contract changes.
 */
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
    decision.action === "create_release" &&
    !candidateBottleIds.has(decision.parentBottleId)
  ) {
    throw new Error(
      `Classifier returned unknown parent bottle id (${decision.parentBottleId}).`,
    );
  }
}

async function getExistingRelease(releaseId: number): Promise<BottleRelease> {
  const [release] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, releaseId))
    .limit(1);

  if (!release) {
    throw new Error(`Bottle release not found (${releaseId}).`);
  }

  return release;
}

export async function applyClassifierCreateDecision({
  decision,
  user,
  createdByActorId,
}: {
  decision: Extract<
    BottleClassificationDecision,
    {
      action: "create_bottle" | "create_release" | "create_bottle_and_release";
    }
  >;
  user: User;
  createdByActorId: number;
}): Promise<{
  bottleId: number;
  releaseId: number | null;
  createdBottle: boolean;
  createdRelease: boolean;
}> {
  const { input, releaseInput } = buildClassifierCreateInputs(decision);

  if (decision.action === "create_bottle") {
    if (!input) {
      throw new Error(
        "Missing proposed bottle input for classifier create_bottle.",
      );
    }

    try {
      const result = await db.transaction(async (tx) =>
        createBottleInTransaction(tx, {
          creationSource: "bottle_classifier",
          createdByActorId,
          input,
          context: { user },
        }),
      );

      await finalizeCreatedBottle(result, {
        creationSource: "bottle_classifier",
      });

      return {
        bottleId: result.bottle.id,
        releaseId: null,
        createdBottle: true,
        createdRelease: false,
      };
    } catch (err) {
      if (err instanceof BottleAlreadyExistsError) {
        return {
          bottleId: err.bottleId,
          releaseId: null,
          createdBottle: false,
          createdRelease: false,
        };
      }
      throw err;
    }
  }

  if (decision.action === "create_release") {
    if (!releaseInput) {
      throw new Error(
        "Missing proposed release input for classifier create_release.",
      );
    }

    try {
      const result = await db.transaction(async (tx) =>
        createBottleReleaseInTransaction(tx, {
          bottleId: decision.parentBottleId,
          createdByActorId,
          input: releaseInput,
          user,
        }),
      );

      await finalizeCreatedBottleRelease(result, {
        creationSource: "bottle_classifier",
      });

      return {
        bottleId: result.release.bottleId,
        releaseId: result.release.id,
        createdBottle: false,
        createdRelease: true,
      };
    } catch (err) {
      if (err instanceof BottleReleaseAlreadyExistsError) {
        const release = await getExistingRelease(err.releaseId);
        return {
          bottleId: release.bottleId,
          releaseId: release.id,
          createdBottle: false,
          createdRelease: false,
        };
      }
      throw err;
    }
  }

  if (!input || !releaseInput) {
    throw new Error(
      "Missing proposed bottle or release input for classifier create_bottle_and_release.",
    );
  }

  const result = await db.transaction(async (tx) => {
    let bottleResult;
    let bottleId: number;

    try {
      bottleResult = await createBottleInTransaction(tx, {
        creationSource: "bottle_classifier",
        createdByActorId,
        input,
        context: { user },
      });
      bottleId = bottleResult.bottle.id;
    } catch (err) {
      if (!(err instanceof BottleAlreadyExistsError)) {
        throw err;
      }
      bottleId = err.bottleId;
    }

    let releaseResult;

    try {
      releaseResult = await createBottleReleaseInTransaction(tx, {
        bottleId,
        createdByActorId,
        input: releaseInput,
        user,
      });
    } catch (err) {
      if (!(err instanceof BottleReleaseAlreadyExistsError)) {
        throw err;
      }

      const [release] = await tx
        .select()
        .from(bottleReleases)
        .where(
          and(
            eq(bottleReleases.id, err.releaseId),
            eq(bottleReleases.bottleId, bottleId),
          ),
        )
        .limit(1);

      if (!release) {
        throw new Error(
          `Bottle release not found for existing classifier create_bottle_and_release result (${err.releaseId}).`,
        );
      }

      return {
        bottleResult,
        releaseResult: null,
        bottleId,
        releaseId: release.id,
      };
    }

    return {
      bottleResult,
      releaseResult,
      bottleId,
      releaseId: releaseResult.release.id,
    };
  });

  if (result.bottleResult) {
    await finalizeCreatedBottle(result.bottleResult, {
      creationSource: "bottle_classifier",
    });
  }
  if (result.releaseResult) {
    await finalizeCreatedBottleRelease(result.releaseResult, {
      creationSource: "bottle_classifier",
    });
  }

  return {
    bottleId: result.bottleId,
    releaseId: result.releaseId,
    createdBottle: !!result.bottleResult,
    createdRelease: !!result.releaseResult,
  };
}

/**
 * Resolve a raw external bottle reference into a bottle/release target. This
 * keeps the zero-cost exact alias fast path, but every ambiguous or new name
 * now goes through the reviewed generic classifier instead of prefix heuristics.
 *
 * Errors are returned as unresolved results instead of being thrown so ingest
 * jobs can preserve the raw source record when classification or creation fails.
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
    const target = await findBottleTarget(aliasName);
    if (target) {
      return {
        bottleId: target.bottleId,
        releaseId: target.releaseId,
        source: "exact_alias",
        error: null,
        confidence: null,
        model: null,
        rationale: null,
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
  } catch (err) {
    return {
      bottleId: null,
      releaseId: null,
      source: "unresolved",
      error: err instanceof Error ? err : new Error("Classifier failed."),
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      createdBottle: false,
      createdRelease: false,
    };
  }

  if (isIgnoredBottleClassification(classification)) {
    return {
      bottleId: null,
      releaseId: null,
      source: "unresolved",
      error: null,
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      createdBottle: false,
      createdRelease: false,
    };
  }

  try {
    assertKnownClassifierTarget(classification.decision, classification);
    const decisionConfidence = normalizeIncomingBottleDecisionConfidence(
      classification.decision.confidence,
    );
    const decisionRationale = classification.decision.rationale ?? null;

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
        source: "classifier_match",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        createdBottle: false,
        createdRelease: false,
      };
    }

    if (classification.decision.action === "no_match") {
      return {
        bottleId: null,
        releaseId: null,
        source: "unresolved",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        createdBottle: false,
        createdRelease: false,
      };
    }

    if (classification.decision.action === "repair_parent_and_create_release") {
      return {
        bottleId: null,
        releaseId: null,
        source: "unresolved",
        error: null,
        confidence: decisionConfidence,
        model: config.OPENAI_MODEL,
        rationale: decisionRationale,
        createdBottle: false,
        createdRelease: false,
      };
    }

    const result = await applyClassifierCreateDecision({
      decision: classification.decision,
      user,
      createdByActorId,
    });

    return {
      bottleId: result.bottleId,
      releaseId: result.releaseId,
      source:
        classification.decision.action === "create_bottle"
          ? "classifier_create_bottle"
          : classification.decision.action === "create_release"
            ? "classifier_create_release"
            : "classifier_create_bottle_and_release",
      error: null,
      confidence: decisionConfidence,
      model: config.OPENAI_MODEL,
      rationale: decisionRationale,
      createdBottle: result.createdBottle,
      createdRelease: result.createdRelease,
    };
  } catch (err) {
    return {
      bottleId: null,
      releaseId: null,
      source: "unresolved",
      error:
        err instanceof Error
          ? err
          : new Error("Failed to apply classifier decision."),
      confidence: null,
      model: config.OPENAI_MODEL,
      rationale: null,
      createdBottle: false,
      createdRelease: false,
    };
  }
}
