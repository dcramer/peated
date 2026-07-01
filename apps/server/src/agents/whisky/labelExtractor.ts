import {
  createWhiskyLabelExtractor,
  extractFromImage as extractFromImageWithClient,
  extractFromText as extractFromTextWithClient,
} from "@peated/bottle-classifier/internal/extractor";
import config from "@peated/server/config";
import { createOpenAIClient } from "@peated/server/lib/openaiClient";

type LegacyExtractorCaskFields = {
  cask_type: string | null;
  cask_size: string | null;
  cask_fill: string | null;
};

function withLegacyCaskFields<T extends object>(
  identity: T | null,
): (T & LegacyExtractorCaskFields) | null {
  return identity
    ? {
        ...identity,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
      }
    : null;
}

export const extractFromImage = async (imageUrlOrBase64: string) =>
  withLegacyCaskFields(
    await extractFromImageWithClient({
      client: createOpenAIClient(),
      model: config.OPENAI_MODEL,
      imageUrlOrBase64,
    }),
  );

export const extractFromText = async (label: string) =>
  withLegacyCaskFields(
    await extractFromTextWithClient({
      client: createOpenAIClient(),
      model: config.OPENAI_MODEL,
      label,
    }),
  );

export { createWhiskyLabelExtractor };
