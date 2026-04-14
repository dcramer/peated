import {
  createWhiskyLabelExtractor,
  extractFromImage as extractFromImageWithClient,
  extractFromText as extractFromTextWithClient,
} from "@peated/bottle-classifier/extractor";
import config from "@peated/server/config";
import OpenAI from "openai";

function createOpenAIClient() {
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });
}

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
