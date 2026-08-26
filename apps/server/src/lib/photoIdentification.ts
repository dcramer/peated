import { createWhiskyLabelExtractor } from "@peated/bottle-classifier";
import {
  BottleExtractedDetailsSchema,
  ImageBottleEvidenceSchema,
  type BottleExtractedDetails,
  type ImageBottleEvidence,
} from "@peated/server/agents/bottleClassifier";
import config from "@peated/server/config";
import {
  createOpenAIClient,
  withSentryConversation,
} from "@peated/server/lib/openaiClient";
import { instrumentOpenAIResponsesCall } from "@peated/server/lib/openaiResponsesTelemetry";
import { getUploadImageDataUrl } from "@peated/server/lib/uploads";

type PhotoIdentificationPendingImage = {
  id: string;
  imageUrl: string;
};

export async function getPhotoExtractionImageInput({
  pendingUpload,
}: {
  pendingUpload: PhotoIdentificationPendingImage;
}) {
  return await getUploadImageDataUrl(pendingUpload.imageUrl);
}

function maybeField<T extends boolean | number | string | string[]>(
  value: T | null | undefined,
  confidence = 0.75,
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
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
    ...(extractedIdentity?.distillery ?? []),
    extractedIdentity?.bottler,
    extractedIdentity?.edition,
    extractedIdentity?.stated_age
      ? `${extractedIdentity.stated_age} year old`
      : null,
    extractedIdentity?.abv ? `${extractedIdentity.abv}% ABV` : null,
    extractedIdentity?.vintage_year
      ? `${extractedIdentity.vintage_year} vintage`
      : null,
    extractedIdentity?.bottling_year
      ? `bottled ${extractedIdentity.bottling_year}`
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
        model: config.OPENAI_IMAGE_EXTRACTION_MODEL,
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
      series: maybeField(extractedIdentity?.series),
      distillery: maybeField(extractedIdentity?.distillery),
      bottler: maybeField(extractedIdentity?.bottler),
      category: maybeField(extractedIdentity?.category),
      statedAge: maybeField(extractedIdentity?.stated_age),
      abv: maybeField(extractedIdentity?.abv),
      vintageYear: maybeField(extractedIdentity?.vintage_year),
      bottlingYear: maybeField(extractedIdentity?.bottling_year),
      releaseYear: maybeField(extractedIdentity?.release_year),
      edition: maybeField(extractedIdentity?.edition),
      caskStrength: maybeField(extractedIdentity?.cask_strength),
      singleCask: maybeField(extractedIdentity?.single_cask),
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
  if (!config.AI_GATEWAY_API_KEY) {
    return {
      extractedIdentity: null,
      imageEvidence: buildPhotoEvidenceFromExtractedIdentity({
        pendingUpload,
        extractedIdentity: null,
      }),
    };
  }

  const conversationId = `photo_identification:${pendingUpload.id}`;
  const extractedIdentity = await withSentryConversation(
    conversationId,
    async () => {
      return await instrumentOpenAIResponsesCall({
        baseURL: config.AI_GATEWAY_HOST,
        conversationId,
        model: config.OPENAI_IMAGE_EXTRACTION_MODEL,
        callback: async (reportResponse) => {
          const extractor = createWhiskyLabelExtractor({
            client: createOpenAIClient({ instrumentWithSentry: false }),
            model: config.OPENAI_MODEL,
            reasoningEffort: config.OPENAI_REASONING_EFFORT,
            imageModel: config.OPENAI_IMAGE_EXTRACTION_MODEL,
            imageReasoningEffort:
              config.OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
            onImageExtractionMetadata: reportResponse,
          });
          const extraction = await extractor.extractFromImageWithMetadata(
            await getPhotoExtractionImageInput({ pendingUpload }),
          );
          return BottleExtractedDetailsSchema.nullable().parse(
            extraction.result,
          );
        },
      });
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
