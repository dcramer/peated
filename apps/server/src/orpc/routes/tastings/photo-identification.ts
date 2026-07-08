// This route owns the photo lookup boundary for add-tasting. It may create or
// reuse a pending upload, but it must not create tastings, bottles, releases, or
// durable classifier trace rows.
import {
  agentActionRiskClass,
  deriveAutomationTier,
} from "@peated/bottle-classifier/priceMatchingEvidence";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import { identifyExistingBottleReference } from "@peated/server/agents/bottleClassifier/identifyExistingBottleReference";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { logError } from "@peated/server/lib/log";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import {
  buildPhotoReferenceName,
  extractPhotoBottleEvidence,
} from "@peated/server/lib/photoIdentification";
import { signPhotoIdentificationCreateToken } from "@peated/server/lib/photoIdentificationCreateToken";
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
import * as Sentry from "@sentry/node";
import type { z } from "zod";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};
type PhotoIdentificationClassification = Awaited<
  ReturnType<typeof classifyBottleReference>
>;
type PhotoIdentificationAttributeValue =
  | boolean
  | number
  | string
  | string[]
  | number[];
type SentrySpanLike = {
  setAttribute: (key: string, value: PhotoIdentificationAttributeValue) => void;
};

const PHOTO_IDENTIFICATION_LOG_MESSAGE =
  "Bottle photo identification completed";

const photoIdentificationRateLimit = createRateLimit<AuthenticatedContext>({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: "photo-identification",
});

type PhotoIdentificationDecision = Extract<
  PhotoIdentificationClassification,
  { status: "classified" }
>["decision"];

// Derives the automation tier for a photo-identification decision. Photo
// identification always carries the uploaded bottle photo as primary image
// evidence and never resolves against a current bottle assignment. The user
// still confirms the suggested next step, so this tier only chooses between the
// confirm and manual-search suggestions rather than acting silently. The
// numeric `confidence` is no longer read for this gate.
function derivePhotoIdentificationTier(decision: PhotoIdentificationDecision) {
  const confidenceBasis = decision.confidenceBasis;

  return deriveAutomationTier({
    actionRiskClass: agentActionRiskClass(decision.action),
    hasUnresolvedRisks: (confidenceBasis?.unresolvedRisks.length ?? 0) > 0,
    webEvidence: confidenceBasis?.webEvidence ?? null,
    hasMatchTarget:
      decision.action === "match" && decision.matchedBottleId !== null,
    reaffirmsCurrentAssignment: false,
    replacesCurrentAssignment: false,
    matchesFreshReleaseTarget:
      decision.action === "match" && decision.matchedReleaseId !== null,
    hasExactAliasAnchor: false,
    hasDeterministicAnchor: decision.identityScope === "exact_cask",
    hasPrimaryLabelOrImageEvidence: true,
  });
}

export function isPhotoIdentificationCreateDecisionAutoCreatable(
  decision: PhotoIdentificationDecision,
) {
  return derivePhotoIdentificationTier(decision) === "auto";
}

function getSuggestedNextStep(
  classification: PhotoIdentificationClassification,
): z.infer<typeof PhotoIdentificationSuggestedNextStepEnum> {
  if (classification.status === "ignored") {
    return "manual_search";
  }

  switch (classification.decision.action) {
    case "match":
      return derivePhotoIdentificationTier(classification.decision) === "auto"
        ? "confirm_match"
        : "manual_search";
    case "create_bottle":
    case "create_release":
    case "create_bottle_and_release":
    case "repair_parent_and_create_release":
      return isPhotoIdentificationCreateDecisionAutoCreatable(
        classification.decision,
      )
        ? "confirm_create"
        : "manual_search";
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
        parentBottleId: decision.parentBottleId,
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
      confidence: null,
      reason: classification.decision.rationale,
    },
  };
}

function getClassificationLogAttributes(
  prefix: string,
  classification: PhotoIdentificationClassification,
) {
  const candidates = classification.artifacts.candidates;
  const candidateBottleIds = classification.artifacts.candidates
    .map((candidate) => candidate.bottleId)
    .filter((id): id is number => typeof id === "number");
  const candidateReleaseIds = classification.artifacts.candidates
    .map((candidate) => candidate.releaseId)
    .filter((id): id is number => typeof id === "number");
  const candidateNames = classification.artifacts.candidates
    .map((candidate) => candidate.fullName)
    .filter(Boolean)
    .slice(0, 5);
  // Sentry span attributes support scalar arrays, not object arrays, so keep a
  // bounded route-owned JSON-string projection for candidate trait debugging.
  const candidateIdentity = candidates.slice(0, 5).map((candidate) =>
    JSON.stringify({
      bottleId: candidate.bottleId,
      releaseId: candidate.releaseId,
      fullName: candidate.fullName,
      category: candidate.category,
      statedAge: candidate.statedAge,
      abv: candidate.abv,
      vintageYear: candidate.vintageYear,
      releaseYear: candidate.releaseYear,
      edition: candidate.edition,
    }),
  );
  const attrs: Record<string, string | number | boolean | string[] | number[]> =
    {
      [`${prefix}.status`]: classification.status,
      [`${prefix}.candidate_count`]: candidates.length,
      [`${prefix}.candidate_bottle_ids`]: candidateBottleIds,
      [`${prefix}.candidate_release_ids`]: candidateReleaseIds,
      [`${prefix}.candidate_names`]: candidateNames,
      [`${prefix}.candidate_identity`]: candidateIdentity,
    };

  if (classification.status === "ignored") {
    attrs[`${prefix}.reason`] = classification.reason;
    return attrs;
  }

  const { decision } = classification;
  attrs[`${prefix}.action`] = decision.action;
  if (decision.confidenceBasis) {
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

function getImageEvidenceFieldAttributes(
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"],
) {
  const attrs: Record<string, string | number> = {};
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

  return attrs;
}

function getSearchEvidenceLogAttributes(
  prefix: string,
  classification: PhotoIdentificationClassification,
) {
  const searchEvidence = classification.artifacts.searchEvidence;
  const resultSummaries = searchEvidence.flatMap((evidence) =>
    evidence.results.map((result) =>
      [result.title, getSearchResultDomain(result)].filter(Boolean).join(" - "),
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

function getSearchResultDomain({
  domain,
  url,
}: {
  domain?: string | null;
  url: string;
}) {
  if (domain) return domain;

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function setSpanAttributes(
  span: SentrySpanLike,
  attrs: Record<string, PhotoIdentificationAttributeValue>,
) {
  for (const [key, value] of Object.entries(attrs)) {
    span.setAttribute(key, value);
  }
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

  Object.assign(attrs, getImageEvidenceFieldAttributes(imageEvidence));

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
  const failureContext = {
    userId: context.user.id,
    pendingImageId: pendingImage.id,
    pendingImageUrl: pendingImage.imageUrl,
    idempotencyKey,
    outcome: "failed",
    fileSize: file.size,
    fileType: file.type || "unknown",
  };

  logInfo(PHOTO_IDENTIFICATION_LOG_MESSAGE, {
    "photo_identification.user_id": failureContext.userId,
    "photo_identification.pending_image_id": failureContext.pendingImageId,
    "photo_identification.idempotency_key": failureContext.idempotencyKey,
    "photo_identification.outcome": "failed",
    "photo_identification.file_size": failureContext.fileSize,
    "photo_identification.file_type": failureContext.fileType,
    "photo_identification.error_name": error?.name ?? typeof err,
    "photo_identification.error_message":
      error?.message ?? "Unknown photo identification failure.",
  });
  logError(err, {
    photoIdentification: failureContext,
  });
}

/**
 * Runs label extraction and local matching for a pending scan, using the full
 * classifier only when the local pass does not produce a match.
 *
 * This is the shared Photo Identification agent span boundary for all callers.
 */
export async function identifyPendingImage({
  pendingImage,
}: {
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
}) {
  const conversationId = `photo_identification:${pendingImage.id}`;

  return await Sentry.startSpan(
    {
      op: "gen_ai.invoke_agent",
      name: "invoke_agent Photo Identification",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "Photo Identification",
        "gen_ai.conversation.id": conversationId,
        "photo_identification.pending_image_id": pendingImage.id,
        "photo_identification.source_image_url": absoluteUrl(
          config.API_SERVER,
          pendingImage.imageUrl,
        ),
        "photo_identification.upload_path": pendingImage.imageUrl,
      },
    },
    async (span) => {
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
        conversationId,
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
      const referenceName = classificationInput.reference.name;
      const diagnostics = buildPhotoIdentificationDiagnostics({
        extractionStatus: extractedIdentity ? "found" : "empty",
        extractionSummary: summarizeExtraction(imageEvidence),
        classification,
      });
      const suggestedNextStep = getSuggestedNextStep(classification);

      setSpanAttributes(span, {
        "photo_identification.reference_name": referenceName,
        "photo_identification.extracted_identity_summary": referenceName,
        "photo_identification.image_evidence_summary":
          diagnostics.extraction.summary ?? "none",
        "photo_identification.initial_candidate_count":
          localIdentification.artifacts.candidates.length,
        "photo_identification.final_candidate_count":
          classification.artifacts.candidates.length,
        "photo_identification.suggested_next_step": suggestedNextStep,
        ...getImageEvidenceFieldAttributes(imageEvidence),
        ...getClassificationLogAttributes(
          "photo_identification.local",
          localIdentification,
        ),
        ...getClassificationLogAttributes(
          "photo_identification.final",
          classification,
        ),
      });

      return {
        imageEvidence,
        localIdentification,
        classification,
        referenceName,
        diagnostics,
        suggestedNextStep,
      };
    },
  );
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
      suggestedNextStep,
    } = identification;
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
    const createToken =
      classification.status === "classified" &&
      suggestedNextStep === "confirm_create" &&
      isPhotoIdentificationCreateDecisionAutoCreatable(classification.decision)
        ? await signPhotoIdentificationCreateToken({
            type: "photo_identification_create",
            userId: context.user.id,
            pendingImageId: pendingImage.id,
            decision: classification.decision,
            photoSuitability: imageEvidence.photoSuitability,
            candidateBottleIds: classification.artifacts.candidates.map(
              (candidate) => candidate.bottleId,
            ),
          })
        : null;

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
      createToken,
    };
  });
