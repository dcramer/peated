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
    decision.action === "match" &&
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

async function applyClassifierCreateDecision({
  decision,
  user,
}: {
  decision: Extract<
    BottleClassificationDecision,
    {
      action: "create_bottle" | "create_release" | "create_bottle_and_release";
    }
  >;
  user: User;
}): Promise<{ bottleId: number; releaseId: number | null }> {
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
          input,
          context: { user },
        }),
      );

      await finalizeCreatedBottle(result);

      return {
        bottleId: result.bottle.id,
        releaseId: null,
      };
    } catch (err) {
      if (err instanceof BottleAlreadyExistsError) {
        return {
          bottleId: err.bottleId,
          releaseId: null,
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
          input: releaseInput,
          user,
        }),
      );

      await finalizeCreatedBottleRelease(result);

      return {
        bottleId: result.release.bottleId,
        releaseId: result.release.id,
      };
    } catch (err) {
      if (err instanceof BottleReleaseAlreadyExistsError) {
        const release = await getExistingRelease(err.releaseId);
        return {
          bottleId: release.bottleId,
          releaseId: release.id,
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
    await finalizeCreatedBottle(result.bottleResult);
  }
  if (result.releaseResult) {
    await finalizeCreatedBottleRelease(result.releaseResult);
  }

  return {
    bottleId: result.bottleId,
    releaseId: result.releaseId,
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
}: {
  reference: BottleReference;
  aliasLookupNames?: string[];
  extractedIdentity?: Partial<BottleExtractedDetails> | null;
  user: User;
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
  } catch (err) {
    return {
      bottleId: null,
      releaseId: null,
      source: "unresolved",
      error: err instanceof Error ? err : new Error("Classifier failed."),
    };
  }

  if (isIgnoredBottleClassification(classification)) {
    return {
      bottleId: null,
      releaseId: null,
      source: "unresolved",
      error: null,
    };
  }

  try {
    assertKnownClassifierTarget(classification.decision, classification);

    if (classification.decision.action === "match") {
      return {
        bottleId: classification.decision.matchedBottleId,
        releaseId: classification.decision.matchedReleaseId,
        source: "classifier_match",
        error: null,
      };
    }

    if (classification.decision.action === "no_match") {
      return {
        bottleId: null,
        releaseId: null,
        source: "unresolved",
        error: null,
      };
    }

    const result = await applyClassifierCreateDecision({
      decision: classification.decision,
      user,
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
    };
  }
}
