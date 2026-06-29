import {
  createWhiskyLabelExtractor,
  extractFromImage as extractFromImageWithClient,
  extractFromText as extractFromTextWithClient,
} from "@peated/bottle-classifier/internal/extractor";
import config from "@peated/server/config";
import { createOpenAIClient } from "@peated/server/lib/openaiClient";

export const extractFromImage = async (imageUrlOrBase64: string) =>
  await extractFromImageWithClient({
    client: createOpenAIClient(),
    model: config.OPENAI_MODEL,
    imageUrlOrBase64,
  });

export const extractFromText = async (label: string) =>
  await extractFromTextWithClient({
    client: createOpenAIClient(),
    model: config.OPENAI_MODEL,
    label,
  });

export { createWhiskyLabelExtractor };
