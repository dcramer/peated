import { createWhiskyLabelExtractor } from "@peated/bottle-classifier";
import {
  BottleExtractedDetailsSchema,
  ImageBottleEvidenceSchema,
  createIgnoredBottleClassification,
  type BottleClassificationResult,
  type BottleExtractedDetails,
  type ImageBottleEvidence,
} from "@peated/server/agents/bottleClassifier";
import config from "@peated/server/config";
import {
  createOpenAIClient,
  withSentryConversation,
} from "@peated/server/lib/openaiClient";
import { readFile } from "@peated/server/lib/uploads";

const PHOTO_IDENTIFICATION_TIMEOUT_MS = 60_000;

type PhotoIdentificationPendingImage = {
  id: string;
  imageUrl: string;
};

function filenameFromUploadUrl(imageUrl: string): string {
  if (!imageUrl.startsWith("/uploads/")) {
    throw new Error("Pending image URL is not an upload URL.");
  }
  return imageUrl.slice("/uploads/".length);
}

export async function getPhotoExtractionImageInput({
  pendingUpload,
}: {
  pendingUpload: PhotoIdentificationPendingImage;
}) {
  const filename = filenameFromUploadUrl(pendingUpload.imageUrl);
  const image = await readFile({ filename });
  return `data:image/webp;base64,${image.toString("base64")}`;
}

function maybeField<T extends string | number>(
  value: T | null | undefined,
  confidence = 0.75,
) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return {
    value,
    confidence,
    sourceExtractorIndexes: [0],
  };
}

/**
 * Converts reviewed label extraction output into the image-evidence contract
 * consumed by the bottle classifier and returned by photo identification.
 */
export function buildPhotoEvidenceFromExtractedIdentity({
  pendingUpload,
  extractedIdentity,
}: {
  pendingUpload: PhotoIdentificationPendingImage;
  extractedIdentity: BottleExtractedDetails | null;
}): ImageBottleEvidence {
  const labelParts = [
    extractedIdentity?.brand,
    extractedIdentity?.expression,
    extractedIdentity?.series,
    extractedIdentity?.edition,
    extractedIdentity?.stated_age
      ? `${extractedIdentity.stated_age} year old`
      : null,
    extractedIdentity?.abv ? `${extractedIdentity.abv}% ABV` : null,
    extractedIdentity?.vintage_year
      ? `${extractedIdentity.vintage_year} vintage`
      : null,
    extractedIdentity?.release_year
      ? `${extractedIdentity.release_year} release`
      : null,
  ].filter(Boolean);

  return ImageBottleEvidenceSchema.parse({
    sourceImageId: pendingUpload.id,
    extractors: [
      {
        kind: "vision",
        model: config.OPENAI_MODEL,
        confidence: extractedIdentity ? 0.75 : 0,
        textSpans: labelParts.length
          ? [
              {
                text: labelParts.join(" "),
                confidence: 0.75,
              },
            ]
          : [],
        observations: extractedIdentity
          ? ["Read whisky label identity from the uploaded bottle photo."]
          : ["No reliable bottle identity was read from the uploaded photo."],
      },
    ],
    fieldCandidates: {
      brand: maybeField(extractedIdentity?.brand),
      expression: maybeField(extractedIdentity?.expression),
      statedAge: maybeField(extractedIdentity?.stated_age),
      abv: maybeField(extractedIdentity?.abv),
      vintageYear: maybeField(extractedIdentity?.vintage_year),
      releaseYear: maybeField(extractedIdentity?.release_year),
      edition: maybeField(extractedIdentity?.edition),
      caskType: maybeField(extractedIdentity?.cask_type),
    },
    photoSuitability: {
      isSingleBottlePhoto: Boolean(extractedIdentity),
      labelReadable: Boolean(extractedIdentity),
      suitableAsTastingImage: true,
      suitableAsBottleImage: Boolean(extractedIdentity),
      reason: extractedIdentity
        ? null
        : "No reliable label identity was extracted from the photo.",
    },
    conflicts: [],
  });
}

/**
 * Runs the server-owned whisky label extraction boundary for a pending image.
 */
export async function extractPhotoBottleEvidence({
  pendingUpload,
}: {
  pendingUpload: PhotoIdentificationPendingImage;
}): Promise<{
  extractedIdentity: BottleExtractedDetails | null;
  imageEvidence: ImageBottleEvidence;
}> {
  if (!config.OPENAI_API_KEY) {
    return {
      extractedIdentity: null,
      imageEvidence: buildPhotoEvidenceFromExtractedIdentity({
        pendingUpload,
        extractedIdentity: null,
      }),
    };
  }

  const extractedIdentity = await withSentryConversation(
    `photo_identification:${pendingUpload.id}`,
    async () => {
      const extractor = createWhiskyLabelExtractor({
        client: createOpenAIClient(),
        model: config.OPENAI_MODEL,
      });
      return BottleExtractedDetailsSchema.nullable().parse(
        await extractor.extractFromImage(
          await getPhotoExtractionImageInput({ pendingUpload }),
        ),
      );
    },
  );

  return {
    extractedIdentity,
    imageEvidence: buildPhotoEvidenceFromExtractedIdentity({
      pendingUpload,
      extractedIdentity,
    }),
  };
}

export function buildPhotoReferenceName(
  extractedIdentity: BottleExtractedDetails | null,
) {
  const parts = [
    extractedIdentity?.brand,
    extractedIdentity?.expression,
    extractedIdentity?.series,
    extractedIdentity?.edition,
    extractedIdentity?.stated_age
      ? `${extractedIdentity.stated_age} year old`
      : null,
    extractedIdentity?.vintage_year
      ? `${extractedIdentity.vintage_year}`
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "Bottle photo upload";
}

/**
 * Creates the classifier-shaped fallback result used when the photo flow should
 * preserve the pending image and continue through manual search.
 */
export function createManualSearchPhotoClassification({
  imageEvidence,
  reason = "Photo identification could not produce a reviewed bottle match.",
}: {
  imageEvidence: ImageBottleEvidence;
  reason?: string;
}): BottleClassificationResult {
  return createIgnoredBottleClassification({
    reason,
    artifacts: {
      extractedIdentity: null,
      imageEvidence,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
    },
  });
}

/**
 * Bounds the user-visible identification wait while returning a caller-owned
 * fallback result instead of failing the pending upload.
 */
export async function withPhotoIdentificationTimeout<T>(
  work: Promise<T>,
  fallback: () => T,
  timeoutMs = PHOTO_IDENTIFICATION_TIMEOUT_MS,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
