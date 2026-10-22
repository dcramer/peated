// This route owns the photo lookup boundary for add-tasting. It may create or
// reuse a pending upload, but it must not create tastings, bottles, or durable
// classifier trace rows.
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { isModelServiceUnavailable } from "@peated/server/lib/openaiClient";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import {
  getClassificationLogAttributes,
  getImageEvidenceFieldAttributes,
  identifyBottlePhoto,
  isPhotoIdentificationCreateDecisionAutoCreatable,
  PHOTO_IDENTIFICATION_RATE_LIMIT,
  serializeProposedBottle,
  type PhotoIdentificationAttributes,
  type PhotoIdentificationClassification,
  type PhotoIdentificationModelMetadata,
} from "@peated/server/lib/photoIdentification";
import { signPhotoIdentificationCreateToken } from "@peated/server/lib/photoIdentificationCreateToken";
import { humanizeBytes } from "@peated/server/lib/strings";
import { logInfo } from "@peated/server/lib/structuredLog";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { implement } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import photoIdentificationContract from "@peated/server/orpc/contracts/tastings/photo-identification";
import {
  createRateLimit,
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  type PhotoIdentificationDiagnosticsSchema,
  type PhotoIdentificationSchema,
  type PhotoIdentificationSuggestedNextStepEnum,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { z } from "zod";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};
export type PhotoIdentificationProcedureServices = {
  createPendingImage: typeof createPendingImageUpload;
  identifyImage: typeof identifyBottlePhoto;
};

const PHOTO_IDENTIFICATION_LOG_MESSAGE =
  "Bottle photo identification completed";

const photoIdentificationRateLimit = createRateLimit<AuthenticatedContext>(
  PHOTO_IDENTIFICATION_RATE_LIMIT,
);

/**
 * Strips server-owned classifier internals from the browser response while
 * preserving the fields the photo tasting flow needs to continue.
 */
async function serializePhotoIdentificationClassification(
  classification: PhotoIdentificationClassification,
): Promise<z.infer<typeof PhotoIdentificationSchema>["classification"]> {
  const artifacts = {
    candidates: classification.artifacts.candidates.map((candidate) => ({
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
    case "match": {
      const bottleId = decision.matchedBottleId;

      const matchedBottle = await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottleId),
      });
      const tombstone = await db.query.bottleTombstones.findFirst({
        columns: { bottleId: true },
        where: (tombstones, { eq }) => eq(tombstones.bottleId, bottleId),
      });
      if (!matchedBottle || tombstone) {
        throw new Error("Photo identification match is not an active Bottle.");
      }

      serializedDecision = {
        action: "match",
        matchedBottle: await serialize(
          BottleSerializer,
          matchedBottle,
          undefined,
          [],
          { includeGroupSummary: true },
        ),
      };
      break;
    }
    case "create_bottle":
      serializedDecision = {
        action: "create_bottle",
        proposedBottle: serializeProposedBottle(decision.proposedBottle),
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
  classification,
  modelMetadata,
  diagnostics,
  suggestedNextStep,
}: {
  context: AuthenticatedContext;
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
  idempotencyKey: string;
  file: Blob;
  referenceName: string;
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"];
  classification: PhotoIdentificationClassification;
  modelMetadata: PhotoIdentificationModelMetadata;
  diagnostics: z.infer<typeof PhotoIdentificationDiagnosticsSchema>;
  suggestedNextStep: z.infer<typeof PhotoIdentificationSuggestedNextStepEnum>;
}) {
  const attrs: PhotoIdentificationAttributes = {
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
      "photo_identification.final",
      classification,
      modelMetadata,
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
  logInfo(PHOTO_IDENTIFICATION_LOG_MESSAGE, {
    "photo_identification.user_id": context.user.id,
    "photo_identification.pending_image_id": pendingImage.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": "failed",
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
    "photo_identification.error_name": error?.name ?? "NonErrorThrown",
    "photo_identification.retryable":
      error !== null && isModelServiceUnavailable(error),
  });
  // Global RPC middleware reports the error to Sentry.
}

const photoIdentificationProcedureServices: PhotoIdentificationProcedureServices =
  {
    createPendingImage: createPendingImageUpload,
    identifyImage: identifyBottlePhoto,
  };

export function createPhotoIdentificationProcedure(
  services: PhotoIdentificationProcedureServices = photoIdentificationProcedureServices,
) {
  return implement(photoIdentificationContract)
    .use(requireAuth)
    .use(requireTosAccepted)
    .use(photoIdentificationRateLimit)
    .handler(async function ({ input, context, errors, signal }) {
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
        pendingImage = await services.createPendingImage({
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

      let identification: Awaited<ReturnType<typeof identifyBottlePhoto>>;
      try {
        identification = await services.identifyImage({
          photo: pendingImage,
          traceAttributes: {
            "photo_identification.pending_image_id": pendingImage.id,
          },
          // Stop paying for the bottle lookup once the member has gone.
          signal,
        });
      } catch (err) {
        logPhotoIdentificationFailure({
          context,
          pendingImage,
          idempotencyKey,
          file,
          err,
        });
        if (err instanceof Error && isModelServiceUnavailable(err)) {
          throw errors.SERVICE_UNAVAILABLE({ cause: err });
        }
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Unable to identify bottle from photo.",
          cause: err,
        });
      }

      const {
        imageEvidence,
        classification,
        modelMetadata,
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
        classification,
        modelMetadata,
        diagnostics,
        suggestedNextStep,
      });
      const createToken =
        classification.status === "classified" &&
        suggestedNextStep === "confirm_create" &&
        isPhotoIdentificationCreateDecisionAutoCreatable(
          classification.decision,
        )
          ? await signPhotoIdentificationCreateToken({
              type: "photo_identification_create",
              userId: context.user.id,
              pendingImageId: pendingImage.id,
              decision: classification.decision,
              photoSuitability: imageEvidence.photoSuitability,
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
          await serializePhotoIdentificationClassification(classification),
        suggestedNextStep,
        diagnostics,
        createToken,
      };
    });
}

export default createPhotoIdentificationProcedure();
