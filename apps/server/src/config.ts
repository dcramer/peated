import { resolveOpenAICompatibleConfig } from "@peated/bottle-classifier/openaiCompatibleConfig";
import { tmpdir } from "node:os";

type Environment = Readonly<Record<string, string | undefined>>;

function parseFeatureFlag(
  name: string,
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value === "") return defaultValue;

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
      return true;
    case "0":
    case "false":
      return false;
    default:
      throw new Error(`${name} must be one of: 1, true, 0, false`);
  }
}

export function resolveBottleCheckFeatureFlags(environment: Environment) {
  return {
    BOTTLE_CHECK_SHADOW_GENERATION: parseFeatureFlag(
      "BOTTLE_CHECK_SHADOW_GENERATION",
      environment.BOTTLE_CHECK_SHADOW_GENERATION,
      true,
    ),
    BOTTLE_CHECK_MODERATOR_VISIBILITY: parseFeatureFlag(
      "BOTTLE_CHECK_MODERATOR_VISIBILITY",
      environment.BOTTLE_CHECK_MODERATOR_VISIBILITY,
      true,
    ),
    BOTTLE_CHECK_EXECUTION: parseFeatureFlag(
      "BOTTLE_CHECK_EXECUTION",
      environment.BOTTLE_CHECK_EXECUTION,
      false,
    ),
  };
}

const openAIConfig = resolveOpenAICompatibleConfig(process.env);
const bottleCheckFeatureFlags = resolveBottleCheckFeatureFlags(process.env);

export default {
  ENV:
    process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV !== "test"
        ? "development"
        : "test",
  DEBUG: !!process.env.DEBUG,
  PORT: Number(process.env.PORT || "4300"),
  HOST: process.env.HOST || "localhost",
  CORS_HOST: process.env.CORS_HOST || "http://localhost:3200",
  JWT_SECRET: process.env.JWT_SECRET || "",
  API_SERVER: process.env.API_SERVER || "http://localhost:4300",
  URL_PREFIX: process.env.URL_PREFIX || "http://localhost:3200",
  REDIS_URL: process.env.REDIS_URL || "redis://@localhost:16379",

  SKIP_EMAIL_VERIFICATION: !!process.env.SKIP_EMAIL_VERIFICATION,

  SMTP_FROM: process.env.SMTP_FROM || "no-reply@peated.com",
  SMTP_REPLY_TO: process.env.SMTP_REPLY_TO || "no-reply@peated.com",
  SMTP_HOST: process.env.SMTP_HOST || "localhost",
  SMTP_PORT: Number(process.env.SMTP_PORT || "465"),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM_NAME: "Peated",

  VERSION: process.env.VERSION || "",

  SENTRY_DSN: process.env.SENTRY_DSN || "",
  SENTRY_SERVICE: process.env.SENTRY_SERVICE || "@peated/server",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CLIENT_IDS: process.env.GOOGLE_CLIENT_IDS
    ? process.env.GOOGLE_CLIENT_IDS.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [],

  UPLOAD_PATH: process.env.UPLOAD_PATH || tmpdir(),

  USE_GCS_STORAGE: !!process.env.USE_GCS_STORAGE,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GCS_BUCKET_PATH: process.env.GCS_BUCKET_PATH,

  GCP_CREDENTIALS: process.env.GCP_CREDENTIALS
    ? JSON.parse(process.env.GCP_CREDENTIALS)
    : null,

  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

  OPENAI_API_KEY: openAIConfig.apiKey,
  OPENAI_EMBEDDING_MODEL: openAIConfig.embeddingModel,
  OPENAI_HOST: openAIConfig.baseURL,
  OPENAI_IMAGE_EXTRACTION_MODEL: openAIConfig.imageExtractionModel,
  OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT:
    openAIConfig.imageExtractionReasoningEffort,
  OPENAI_MODEL: openAIConfig.model,
  OPENAI_REASONING_EFFORT: openAIConfig.reasoningEffort,
  OPENAI_ORGANIZATION:
    openAIConfig.organization ||
    (openAIConfig.provider === "openai"
      ? "org-c11AVkF35wixZcGri1YBH9Pq"
      : null),
  OPENAI_PROJECT: openAIConfig.project || null,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || null,
  FIRECRAWL_API_URL: process.env.FIRECRAWL_API_URL || null,
  BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES: Number(
    process.env.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES ||
      process.env.PRICE_MATCH_MAX_SEARCH_QUERIES ||
      "3",
  ),
  ENTITY_CLASSIFIER_MAX_SEARCH_QUERIES: Number(
    process.env.ENTITY_CLASSIFIER_MAX_SEARCH_QUERIES ||
      process.env.ENTITY_AUDITOR_MAX_SEARCH_QUERIES ||
      process.env.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES ||
      process.env.PRICE_MATCH_MAX_SEARCH_QUERIES ||
      "2",
  ),
  PRICE_MATCH_MAX_SEARCH_QUERIES: Number(
    process.env.PRICE_MATCH_MAX_SEARCH_QUERIES ||
      process.env.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES ||
      "3",
  ),
  PRICE_MATCH_RETRY_RUN_BATCH_SIZE: Number(
    process.env.PRICE_MATCH_RETRY_RUN_BATCH_SIZE || "10",
  ),
  PRICE_MATCH_RETRY_RUN_DELAY_MS: Number(
    process.env.PRICE_MATCH_RETRY_RUN_DELAY_MS || "30000",
  ),
  CATALOG_VERIFICATION_AUTOMATION_SAMPLE_RATE: Number(
    process.env.CATALOG_VERIFICATION_AUTOMATION_SAMPLE_RATE || "0.1",
  ),

  ...bottleCheckFeatureFlags,

  DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK,
};
