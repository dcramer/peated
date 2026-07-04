// This route owns the photo lookup boundary for add-tasting. It may create or
// reuse a pending upload, but it must not create tastings, bottles, releases, or
// durable classifier trace rows.
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import { identifyExistingBottleReference } from "@peated/server/agents/bottleClassifier/identifyExistingBottleReference";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import {
  buildPhotoReferenceName,
  extractPhotoBottleEvidence,
} from "@peated/server/lib/photoIdentification";
import { humanizeBytes } from "@peated/server/lib/strings";
import { logInfo } from "@peated/server/lib/structuredLog";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import {
  createRateLimit,
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  PhotoIdentificationInputSchema,
  PhotoIdentificationSchema,
  type PhotoIdentificationDiagnosticsSchema,
  type PhotoIdentificationSuggestedNextStepEnum,
} from "@peated/server/schemas";
import type { z } from "zod";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};
type PhotoIdentificationClassification = Awaited<
  ReturnType<typeof classifyBottleReference>
>;

export const PHOTO_IDENTIFICATION_CREATE_CONFIDENCE_THRESHOLD = 70;
const PHOTO_IDENTIFICATION_LOG_MESSAGE =
  "Bottle photo identification completed";

const photoIdentificationRateLimit = createRateLimit<AuthenticatedContext>({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: "photo-identification",
});

export function isPhotoIdentificationCreateDecisionAutoCreatable(
  decision: Extract<
    PhotoIdentificationClassification,
    { status: "classified" }
  >["decision"],
) {
  const confidenceBasisBand = decision.confidenceBasis?.band;

  return (
    decision.confidence >= PHOTO_IDENTIFICATION_CREATE_CONFIDENCE_THRESHOLD &&
    (confidenceBasisBand === undefined ||
      confidenceBasisBand === "auto_verification")
  );
}

function getSuggestedNextStep(
  classification: PhotoIdentificationClassification,
): z.infer<typeof PhotoIdentificationSuggestedNextStepEnum> {
  if (classification.status === "ignored") {
    return "manual_search";
  }

  switch (classification.decision.action) {
    case "match":
      return classification.decision.confidence >= 70
        ? "confirm_match"
        : "manual_search";
    case "create_bottle":
    case "create_release":
    case "create_bottle_and_release":
      return isPhotoIdentificationCreateDecisionAutoCreatable(
        classification.decision,
      )
        ? "confirm_create"
        : "manual_search";
    case "repair_parent_and_create_release":
    case "repair_bottle":
      return "needs_review";
    case "no_match":
      return "manual_search";
  }
}

function summarizeExtraction(
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"],
) {
  const text = imageEvidence.extractors
    .flatMap((extractor) => extractor.textSpans.map((span) => span.text))
    .filter(Boolean)
    .join(" ")
    .trim();

  return text || null;
}

/**
 * Strips server-owned classifier internals from the browser response while
 * preserving the fields the photo tasting flow needs to continue.
 */
function serializePhotoIdentificationClassification(
  classification: PhotoIdentificationClassification,
): z.infer<typeof PhotoIdentificationSchema>["classification"] {
  const artifacts = {
    candidates: classification.artifacts.candidates.map((candidate) => ({
      bottleId: candidate.bottleId,
      releaseId: candidate.releaseId,
      bottleFullName: candidate.bottleFullName,
      fullName: candidate.fullName,
    })),
  };

  if (classification.status === "ignored") {
    return {
      status: "ignored",
      reason: classification.reason,
      artifacts,
    };
  }

  const { decision } = classification;
  type SerializedDecision = Extract<
    z.infer<typeof PhotoIdentificationSchema>["classification"],
    { status: "classified" }
  >["decision"];
  let serializedDecision: SerializedDecision;

  switch (decision.action) {
    case "match":
      serializedDecision = {
        action: "match",
        matchedBottleId: decision.matchedBottleId,
        matchedReleaseId: decision.matchedReleaseId,
      };
      break;
    case "create_bottle":
      serializedDecision = {
        action: "create_bottle",
        proposedBottle: {
          name: decision.proposedBottle.name,
          brand: {
            name: decision.proposedBottle.brand.name,
          },
        },
      };
      break;
    case "create_release":
      serializedDecision = {
        action: "create_release",
        parentBottleId: decision.parentBottleId,
        proposedRelease: {
          edition: decision.proposedRelease.edition,
        },
      };
      break;
    case "create_bottle_and_release":
      serializedDecision = {
        action: "create_bottle_and_release",
        proposedBottle: {
          name: decision.proposedBottle.name,
          brand: {
            name: decision.proposedBottle.brand.name,
          },
        },
        proposedRelease: {
          edition: decision.proposedRelease.edition,
        },
      };
      break;
    case "repair_parent_and_create_release":
      serializedDecision = {
        action: "repair_parent_and_create_release",
      };
      break;
    case "repair_bottle":
      serializedDecision = {
        action: "repair_bottle",
      };
      break;
    case "no_match":
      serializedDecision = {
        action: "no_match",
      };
      break;
  }

  return {
    status: "classified",
    decision: serializedDecision,
    artifacts,
  };
}

function buildPhotoIdentificationDiagnostics({
  extractionStatus,
  extractionSummary,
  classification,
}: {
  extractionStatus: z.infer<
    typeof PhotoIdentificationDiagnosticsSchema
  >["extraction"]["status"];
  extractionSummary: string | null;
  classification: PhotoIdentificationClassification;
}): z.infer<typeof PhotoIdentificationDiagnosticsSchema> {
  const artifacts = classification.artifacts;

  if (classification.status === "ignored") {
    return {
      extraction: {
        status: extractionStatus,
        summary: extractionSummary,
      },
      candidates: {
        count: artifacts.candidates.length,
      },
      classification: {
        status: "ignored",
        action: null,
        confidence: null,
        reason: classification.reason,
      },
    };
  }

  return {
    extraction: {
      status: extractionStatus,
      summary: extractionSummary,
    },
    candidates: {
      count: artifacts.candidates.length,
    },
    classification: {
      status: "classified",
      action: classification.decision.action,
      confidence: classification.decision.confidence,
      reason: classification.decision.rationale,
    },
  };
}

function getClassificationLogAttributes(
  prefix: string,
  classification: PhotoIdentificationClassification,
) {
  const attrs: Record<string, string | number | boolean | string[] | number[]> =
    {
      [`${prefix}.status`]: classification.status,
      [`${prefix}.candidate_count`]: classification.artifacts.candidates.length,
      [`${prefix}.candidate_bottle_ids`]: classification.artifacts.candidates
        .map((candidate) => candidate.bottleId)
        .filter((id): id is number => typeof id === "number"),
      [`${prefix}.candidate_release_ids`]: classification.artifacts.candidates
        .map((candidate) => candidate.releaseId)
        .filter((id): id is number => typeof id === "number"),
      [`${prefix}.candidate_names`]: classification.artifacts.candidates
        .map((candidate) => candidate.fullName)
        .filter(Boolean)
        .slice(0, 5),
    };

  if (classification.status === "ignored") {
    attrs[`${prefix}.reason`] = classification.reason;
    return attrs;
  }

  const { decision } = classification;
  attrs[`${prefix}.action`] = decision.action;
  attrs[`${prefix}.confidence`] = decision.confidence;
  if (decision.confidenceBasis) {
    attrs[`${prefix}.confidence_basis_band`] = decision.confidenceBasis.band;
    attrs[`${prefix}.confidence_basis_web_evidence`] =
      decision.confidenceBasis.webEvidence;
    attrs[`${prefix}.confidence_basis_positive_evidence_count`] =
      decision.confidenceBasis.positiveEvidence.length;
    attrs[`${prefix}.confidence_basis_unresolved_risk_count`] =
      decision.confidenceBasis.unresolvedRisks.length;
    attrs[`${prefix}.confidence_basis_tools_used`] =
      decision.confidenceBasis.toolsUsed;
  }
  if (decision.rationale) attrs[`${prefix}.reason`] = decision.rationale;

  if ("matchedBottleId" in decision && decision.matchedBottleId !== null) {
    attrs[`${prefix}.matched_bottle_id`] = decision.matchedBottleId;
  }
  if ("matchedReleaseId" in decision && decision.matchedReleaseId !== null) {
    attrs[`${prefix}.matched_release_id`] = decision.matchedReleaseId;
  }
  if ("parentBottleId" in decision && decision.parentBottleId !== null) {
    attrs[`${prefix}.parent_bottle_id`] = decision.parentBottleId;
  }
  if ("proposedBottle" in decision && decision.proposedBottle) {
    attrs[`${prefix}.proposed_bottle_brand`] =
      decision.proposedBottle.brand.name;
    attrs[`${prefix}.proposed_bottle_name`] = decision.proposedBottle.name;
  }
  if ("proposedRelease" in decision && decision.proposedRelease?.edition) {
    attrs[`${prefix}.proposed_release_edition`] =
      decision.proposedRelease.edition;
  }

  return attrs;
}

function getSearchEvidenceLogAttributes(
  prefix: string,
  classification: PhotoIdentificationClassification,
) {
  const searchEvidence = classification.artifacts.searchEvidence;
  const resultSummaries = searchEvidence.flatMap((evidence) =>
    evidence.results.map((result) =>
      [result.title, result.domain ?? new URL(result.url).hostname]
        .filter(Boolean)
        .join(" - "),
    ),
  );

  return {
    [`${prefix}.search_evidence_count`]: searchEvidence.length,
    [`${prefix}.search_evidence_result_count`]: resultSummaries.length,
    [`${prefix}.search_queries`]: searchEvidence
      .map((evidence) => evidence.query)
      .slice(0, 5),
    [`${prefix}.search_result_summaries`]: resultSummaries.slice(0, 5),
  };
}

/**
 * Emits one searchable event for each completed photo identification call so
 * production misses can be debugged without reconstructing classifier spans.
 */
function logPhotoIdentificationOutcome({
  context,
  pendingImage,
  idempotencyKey,
  file,
  referenceName,
  imageEvidence,
  localIdentification,
  classification,
  diagnostics,
  suggestedNextStep,
}: {
  context: AuthenticatedContext;
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
  idempotencyKey: string;
  file: Blob;
  referenceName: string;
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"];
  localIdentification: PhotoIdentificationClassification;
  classification: PhotoIdentificationClassification;
  diagnostics: z.infer<typeof PhotoIdentificationDiagnosticsSchema>;
  suggestedNextStep: z.infer<typeof PhotoIdentificationSuggestedNextStepEnum>;
}) {
  const attrs: Record<string, string | number | boolean | string[] | number[]> =
    {
      "photo_identification.user_id": context.user.id,
      "photo_identification.pending_image_id": pendingImage.id,
      "photo_identification.idempotency_key": idempotencyKey,
      "photo_identification.outcome": "completed",
      "photo_identification.file_size": file.size,
      "photo_identification.file_type": file.type || "unknown",
      "photo_identification.reference_name": referenceName,
      "photo_identification.suggested_next_step": suggestedNextStep,
      "photo_identification.extraction_status": diagnostics.extraction.status,
      "photo_identification.candidate_count": diagnostics.candidates.count,
      "photo_identification.is_single_bottle_photo":
        imageEvidence.photoSuitability.isSingleBottlePhoto,
      "photo_identification.label_readable":
        imageEvidence.photoSuitability.labelReadable,
      "photo_identification.suitable_as_tasting_image":
        imageEvidence.photoSuitability.suitableAsTastingImage,
      "photo_identification.suitable_as_bottle_image":
        imageEvidence.photoSuitability.suitableAsBottleImage,
      ...getClassificationLogAttributes(
        "photo_identification.local",
        localIdentification,
      ),
      ...getClassificationLogAttributes(
        "photo_identification.final",
        classification,
      ),
      ...getSearchEvidenceLogAttributes(
        "photo_identification.final",
        classification,
      ),
    };

  if (diagnostics.extraction.summary) {
    attrs["photo_identification.extraction_summary"] =
      diagnostics.extraction.summary;
  }

  const fieldCandidates = imageEvidence.fieldCandidates;
  for (const field of [
    "brand",
    "expression",
    "statedAge",
    "abv",
    "vintageYear",
    "releaseYear",
    "edition",
  ] as const) {
    const candidate = fieldCandidates[field];
    if (!candidate) continue;
    attrs[`photo_identification.field.${field}`] = candidate.value;
    attrs[`photo_identification.field.${field}.confidence`] =
      candidate.confidence;
  }

  logInfo(PHOTO_IDENTIFICATION_LOG_MESSAGE, attrs);
}

function logPhotoIdentificationRejected({
  context,
  idempotencyKey,
  file,
  outcome,
  reason,
}: {
  context: AuthenticatedContext;
  idempotencyKey: string;
  file: Blob;
  outcome: string;
  reason: string;
}) {
  logInfo(PHOTO_IDENTIFICATION_LOG_MESSAGE, {
    "photo_identification.user_id": context.user.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": outcome,
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
    "photo_identification.error_message": reason,
  });
}

function logPhotoIdentificationFailure({
  context,
  pendingImage,
  idempotencyKey,
  file,
  err,
}: {
  context: AuthenticatedContext;
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
  idempotencyKey: string;
  file: Blob;
  err: unknown;
}) {
  const error = err instanceof Error ? err : null;

  logInfo(PHOTO_IDENTIFICATION_LOG_MESSAGE, {
    "photo_identification.user_id": context.user.id,
    "photo_identification.pending_image_id": pendingImage.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": "failed",
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
    "photo_identification.error_name": error?.name ?? typeof err,
    "photo_identification.error_message":
      error?.message ?? "Unknown photo identification failure.",
  });
}

/**
 * Runs label extraction and local matching for a pending scan, using the full
 * classifier only when the local pass does not produce a match.
 */
export async function identifyPendingImage({
  pendingImage,
}: {
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
}) {
  return await (async () => {
    const { extractedIdentity, imageEvidence } =
      await extractPhotoBottleEvidence({
        pendingUpload: pendingImage,
      });

    const classificationInput = {
      reference: {
        id: pendingImage.id,
        name: buildPhotoReferenceName(extractedIdentity),
        url: null,
        imageUrl: absoluteUrl(config.API_SERVER, pendingImage.imageUrl),
      },
      extractedIdentity,
      imageEvidence,
    };
    const localIdentification =
      await identifyExistingBottleReference(classificationInput);
    const classification =
      localIdentification.status === "classified" &&
      localIdentification.decision.action === "match"
        ? localIdentification
        : await classifyBottleReference(classificationInput);

    return {
      imageEvidence,
      localIdentification,
      classification,
      referenceName: classificationInput.reference.name,
      diagnostics: buildPhotoIdentificationDiagnostics({
        extractionStatus: extractedIdentity ? "found" : "empty",
        extractionSummary: summarizeExtraction(imageEvidence),
        classification,
      }),
    };
  })();
}

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .use(photoIdentificationRateLimit)
  .route({
    method: "POST",
    path: "/tastings/photo-identification",
    summary: "Identify tasting bottle from photo",
    description:
      "Upload a temporary bottle photo, extract label evidence, and classify the likely bottle without creating a tasting.",
    operationId: "identifyTastingBottleFromPhoto",
  })
  .input(PhotoIdentificationInputSchema)
  .output(PhotoIdentificationSchema)
  .handler(async function ({ input, context, errors }) {
    const { file, idempotencyKey } = input;

    if (file.size > MAX_FILESIZE) {
      logPhotoIdentificationRejected({
        context,
        idempotencyKey,
        file,
        outcome: "rejected",
        reason: `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
      });
      throw errors.PAYLOAD_TOO_LARGE({
        message: `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
      });
    }

    let pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
    try {
      pendingImage = await createPendingImageUpload({
        file,
        purpose: "photo_tasting_entry",
        idempotencyKey,
        createdById: context.user.id,
        onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
      });
    } catch (err) {
      const error = err instanceof Error ? err : null;
      logPhotoIdentificationRejected({
        context,
        idempotencyKey,
        file,
        outcome: "failed",
        reason:
          error?.message ??
          "Unable to create pending image for photo identification.",
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to process bottle photo.",
        cause: err,
      });
    }

    let identification: Awaited<ReturnType<typeof identifyPendingImage>>;
    try {
      identification = await identifyPendingImage({
        pendingImage,
      });
    } catch (err) {
      logPhotoIdentificationFailure({
        context,
        pendingImage,
        idempotencyKey,
        file,
        err,
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to identify bottle from photo.",
        cause: err,
      });
    }

    const {
      imageEvidence,
      localIdentification,
      classification,
      referenceName,
      diagnostics,
    } = identification;
    const suggestedNextStep = getSuggestedNextStep(classification);
    logPhotoIdentificationOutcome({
      context,
      pendingImage,
      idempotencyKey,
      file,
      referenceName,
      imageEvidence,
      localIdentification,
      classification,
      diagnostics,
      suggestedNextStep,
    });

    return {
      pendingImage: {
        id: pendingImage.id,
        imageUrl: absoluteUrl(config.API_SERVER, pendingImage.imageUrl),
        expiresAt: pendingImage.expiresAt.toISOString(),
      },
      imageEvidence,
      classification:
        serializePhotoIdentificationClassification(classification),
      suggestedNextStep,
      diagnostics,
    };
  });
