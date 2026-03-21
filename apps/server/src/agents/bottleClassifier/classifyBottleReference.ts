import {
  extractBottleReferenceIdentity as extractReferenceIdentity,
  findBottleReferenceCandidates,
} from "@peated/server/lib/bottleReferenceCandidates";
import {
  finalizeBottleReferenceClassification,
  shouldAutoIgnoreBottleReference,
} from "./classificationPolicy";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  type BottleClassificationArtifacts,
  type BottleClassificationResult,
  type BottleReference,
  type ClassifyBottleReferenceInput,
} from "./contract";
import {
  BottleClassificationError,
  runBottleClassifierAgent,
} from "./runBottleClassifierAgent";
import type { BottleCandidate, BottleExtractedDetails } from "./schemas";

async function extractBottleReferenceIdentity(
  reference: BottleReference,
): Promise<BottleExtractedDetails | null> {
  return await extractReferenceIdentity({
    name: reference.name,
    imageUrl: reference.imageUrl ?? null,
  });
}

async function findInitialBottleCandidates(
  reference: BottleReference,
  extractedIdentity: BottleExtractedDetails | null,
): Promise<BottleCandidate[]> {
  return await findBottleReferenceCandidates(
    {
      name: reference.name,
      bottleId: reference.currentBottleId ?? null,
      releaseId: reference.currentReleaseId ?? null,
    },
    extractedIdentity,
  );
}

async function resolveExtractedIdentity({
  reference,
  extractedIdentity,
}: Pick<
  ClassifyBottleReferenceInput,
  "reference" | "extractedIdentity"
>): Promise<BottleExtractedDetails | null> {
  if (extractedIdentity !== undefined) {
    return extractedIdentity;
  }

  return await extractBottleReferenceIdentity(reference);
}

async function resolveInitialCandidates({
  reference,
  extractedIdentity,
  initialCandidates,
}: Pick<ClassifyBottleReferenceInput, "reference" | "initialCandidates"> & {
  extractedIdentity: BottleExtractedDetails | null;
}): Promise<BottleCandidate[]> {
  if (initialCandidates !== undefined) {
    return initialCandidates;
  }

  return await findInitialBottleCandidates(reference, extractedIdentity);
}

function createIgnoredReferenceClassification(
  artifacts: BottleClassificationArtifacts,
): BottleClassificationResult {
  return createIgnoredBottleClassification({
    reason:
      "Reference is clearly a non-whisky category match and extraction found no whisky identity.",
    artifacts,
  });
}

/**
 * This is the single classification boundary for bottle references.
 *
 * The module owns:
 * 1. best-effort whisky identity extraction
 * 2. initial local candidate retrieval
 * 3. LLM-led reasoning with local/entity/web tools
 * 4. server-side validation and downgrade rules
 *
 * Downstream code should persist this reviewed result, not reinterpret raw
 * agent output or duplicate bottle-identity policy elsewhere. Use-case-specific
 * automation policy should consume this reviewed result after classification.
 */
export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
): Promise<BottleClassificationResult> {
  const parsedInput = ClassifyBottleReferenceInputSchema.parse(input);
  let artifacts = buildBottleClassificationArtifacts({});

  try {
    const extractedIdentity = await resolveExtractedIdentity(parsedInput);

    artifacts = buildBottleClassificationArtifacts({
      extractedIdentity,
    });

    if (
      shouldAutoIgnoreBottleReference(
        parsedInput.reference.name,
        artifacts.extractedIdentity,
      )
    ) {
      return BottleClassificationResultSchema.parse(
        createIgnoredReferenceClassification(artifacts),
      );
    }

    const candidates = await resolveInitialCandidates({
      reference: parsedInput.reference,
      extractedIdentity,
      initialCandidates: parsedInput.initialCandidates,
    });

    artifacts = buildBottleClassificationArtifacts({
      extractedIdentity,
      candidates,
    });

    const reasoning = await runBottleClassifierAgent({
      reference: parsedInput.reference,
      extractedIdentity: artifacts.extractedIdentity,
      initialCandidates: artifacts.candidates,
    });
    const decision = finalizeBottleReferenceClassification({
      reference: parsedInput.reference,
      decision: reasoning.decision,
      artifacts: reasoning.artifacts,
    });

    return BottleClassificationResultSchema.parse(
      createDecidedBottleClassification({
        decision,
        artifacts: reasoning.artifacts,
      }),
    );
  } catch (error) {
    if (error instanceof BottleClassificationError) {
      throw error;
    }

    throw new BottleClassificationError(
      error instanceof Error ? error.message : "Unknown classifier error",
      artifacts,
      {
        cause: error,
      },
    );
  }
}
