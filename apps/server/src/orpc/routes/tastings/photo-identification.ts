// This route owns the photo lookup boundary for add-tasting. It may create or
// reuse a pending upload, but it must not create tastings, bottles, releases, or
// durable classifier trace rows.
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { logError } from "@peated/server/lib/log";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import {
  buildPhotoEvidenceFromExtractedIdentity,
  buildPhotoReferenceName,
  createManualSearchPhotoClassification,
  extractPhotoBottleEvidence,
  withPhotoIdentificationTimeout,
} from "@peated/server/lib/photoIdentification";
import { humanizeBytes } from "@peated/server/lib/strings";
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

const photoIdentificationRateLimit = createRateLimit<AuthenticatedContext>({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: "photo-identification",
});

function getSuggestedNextStep(
  classification: Awaited<ReturnType<typeof classifyBottleReference>>,
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
      return "confirm_create";
    case "repair_parent_and_create_release":
    case "repair_bottle":
      return "needs_review";
    case "no_match":
      return "manual_search";
  }
}

function buildFallbackIdentificationResult({
  pendingImage,
  reason,
  extractionStatus,
}: {
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
  reason: string;
  extractionStatus: z.infer<
    typeof PhotoIdentificationDiagnosticsSchema
  >["extraction"]["status"];
}) {
  const imageEvidence = buildPhotoEvidenceFromExtractedIdentity({
    pendingUpload: pendingImage,
    extractedIdentity: null,
  });
  const classification = createManualSearchPhotoClassification({
    imageEvidence,
    reason,
  });

  return {
    imageEvidence,
    classification,
    diagnostics: buildPhotoIdentificationDiagnostics({
      extractionStatus,
      extractionSummary: reason,
      classification,
    }),
  };
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

function buildPhotoIdentificationDiagnostics({
  extractionStatus,
  extractionSummary,
  classification,
}: {
  extractionStatus: z.infer<
    typeof PhotoIdentificationDiagnosticsSchema
  >["extraction"]["status"];
  extractionSummary: string | null;
  classification: Awaited<ReturnType<typeof classifyBottleReference>>;
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

export async function identifyPendingImage({
  pendingImage,
}: {
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
}) {
  const identification = (async () => {
    const { extractedIdentity, imageEvidence } =
      await extractPhotoBottleEvidence({
        pendingUpload: pendingImage,
      });

    const classification = await classifyBottleReference({
      reference: {
        id: pendingImage.id,
        name: buildPhotoReferenceName(extractedIdentity),
        url: null,
        imageUrl: absoluteUrl(config.API_SERVER, pendingImage.imageUrl),
      },
      extractedIdentity,
      imageEvidence,
    });

    return {
      imageEvidence,
      classification,
      diagnostics: buildPhotoIdentificationDiagnostics({
        extractionStatus: extractedIdentity ? "found" : "empty",
        extractionSummary: summarizeExtraction(imageEvidence),
        classification,
      }),
    };
  })().catch((err) => {
    logError(err, {
      pendingUpload: {
        id: pendingImage.id,
        source: "photo_identification",
      },
    });
    throw err;
  });

  try {
    return await withPhotoIdentificationTimeout(identification, () =>
      buildFallbackIdentificationResult({
        pendingImage,
        reason:
          "Photo identification timed out before a reviewed bottle match was available.",
        extractionStatus: "timed_out",
      }),
    );
  } catch {
    return buildFallbackIdentificationResult({
      pendingImage,
      reason: "Photo identification could not produce a reviewed bottle match.",
      extractionStatus: "failed",
    });
  }
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
      throw errors.PAYLOAD_TOO_LARGE({
        message: `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
      });
    }

    const pendingImage = await createPendingImageUpload({
      file,
      purpose: "photo_tasting_entry",
      idempotencyKey,
      createdById: context.user.id,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const { imageEvidence, classification, diagnostics } =
      await identifyPendingImage({
        pendingImage,
      });
    const suggestedNextStep = getSuggestedNextStep(classification);

    return {
      pendingImage: {
        id: pendingImage.id,
        imageUrl: absoluteUrl(config.API_SERVER, pendingImage.imageUrl),
        expiresAt: pendingImage.expiresAt.toISOString(),
      },
      imageEvidence,
      classification,
      suggestedNextStep,
      diagnostics,
    };
  });
