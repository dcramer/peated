import type { FileRead } from "@peated/bot";
import {
  createWhiskyLabelExtractor,
  getImageLabelExtractionVersion,
} from "@peated/bottle-classifier";
import {
  BottleExtractedDetailsSchema,
  type BottleExtractedDetails,
  type ImageBottleEvidence,
} from "@peated/server/agents/bottleClassifier";
import { readBottleClassifierImageLabel } from "@peated/server/agents/bottleClassifier/contextAdapters";
import config from "@peated/server/config";
import { createLanguageModel } from "@peated/server/lib/aiSdkModels";
import { logInfo } from "@peated/server/lib/log";
import { createServerPeatedBot } from "@peated/server/lib/peatedBot";
import { buildPhotoEvidenceFromExtractedIdentity } from "@peated/server/lib/photoIdentification";
import { scotchWhiskyAuctionsLabelImageUrl } from "@peated/server/scraper/adapters/scotchWhiskyAuctions";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type LabelReading = {
  extractedIdentity: BottleExtractedDetails | null;
  rawLabelText: string | null;
};

export type AuctionLotPhotoServices = {
  readImage: (url: string) => Promise<FileRead>;
  readLabel: (imageDataUrl: string) => Promise<LabelReading>;
};

const auctionLotPhotoServices: AuctionLotPhotoServices = {
  // Source photos are read directly as PeatedBot, never through Firecrawl.
  readImage: async (url) =>
    await createServerPeatedBot({ firecrawlApiKey: null }).readFile({
      url,
      accept: "image/*,*/*;q=0.1",
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 30_000,
    }),
  readLabel: async (imageDataUrl) => {
    const extraction = await createWhiskyLabelExtractor({
      languageModel: (model) => createLanguageModel({ model }),
      model: config.OPENAI_MODEL,
      reasoningEffort: config.OPENAI_REASONING_EFFORT,
      imageModel: config.OPENAI_IMAGE_EXTRACTION_MODEL,
      imageReasoningEffort: config.OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
    }).extractFromImageWithMetadata(imageDataUrl);
    return {
      extractedIdentity: BottleExtractedDetailsSchema.nullable().parse(
        extraction.result,
      ),
      rawLabelText: extraction.rawLabelText,
    };
  },
};

class AuctionLotPhotoUnavailableError extends Error {}

// A photo that is gone, blocked, or too large will not read on a retry.
const LASTING_READ_FAILURES = new Set(["not_found", "blocked", "too_large"]);

/**
 * Reads the label on an auction lot's photo for the classifier.
 *
 * Auction matching rule (owner: auctions): the photo is evidence for facts
 * only. Peated never stores or shows it, and only the label reading is saved,
 * so each photo is read once. A photo that is gone, refused, blocked, or too
 * large returns null, and the lot is classified from its title and details
 * alone. A temporary read failure or a failed label reading throws, so the
 * matching job retries it.
 */
export async function readAuctionLotPhotoEvidence(
  { id, imageUrl }: { id: number; imageUrl: string | null },
  services: AuctionLotPhotoServices = auctionLotPhotoServices,
): Promise<ImageBottleEvidence | null> {
  if (!imageUrl || !config.AI_GATEWAY_API_KEY) return null;

  const labelImageUrl = scotchWhiskyAuctionsLabelImageUrl(imageUrl);
  let reading: LabelReading;
  try {
    reading = await readBottleClassifierImageLabel({
      imageUrl: labelImageUrl,
      version: getImageLabelExtractionVersion({
        model: config.OPENAI_IMAGE_EXTRACTION_MODEL,
        reasoningEffort: config.OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
      }),
      read: async () => {
        const image = await services.readImage(labelImageUrl);
        if (image.status === "ok") {
          const contentType = image.contentType?.startsWith("image/")
            ? image.contentType
            : "image/jpeg";
          return await services.readLabel(
            `data:${contentType};base64,${Buffer.from(image.body).toString("base64")}`,
          );
        }
        if (
          image.status === "refused" ||
          LASTING_READ_FAILURES.has(image.reason)
        )
          throw new AuctionLotPhotoUnavailableError(image.reason);
        throw new Error(
          `Could not read auction lot photo ${labelImageUrl}: ${image.reason}`,
        );
      },
    });
  } catch (error) {
    if (!(error instanceof AuctionLotPhotoUnavailableError)) throw error;
    logInfo("Could not read auction lot photo {imageUrl}: {reason}", {
      extra: { imageUrl: labelImageUrl, reason: error.message },
    });
    return null;
  }

  return buildPhotoEvidenceFromExtractedIdentity({
    photo: { id: `auction_lot:${id}` },
    extractedIdentity: reading.extractedIdentity,
    rawLabelText: reading.rawLabelText,
    source: "auction_lot",
  });
}
