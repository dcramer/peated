import {
  DEFAULT_BOTTLE_CLASSIFIER_MODEL,
  DEFAULT_BOTTLE_CLASSIFIER_REASONING_EFFORT,
  DEFAULT_OPENAI_EVAL_MODEL,
  DEFAULT_OPENAI_EVAL_REASONING_EFFORT,
  DEFAULT_OPENAI_IMAGE_EXTRACTION_MODEL,
  DEFAULT_OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
  DEFAULT_OPENAI_MODEL,
  parseOpenAIReasoningEffort,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";

const VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";

type OpenAICompatibleEnvKey =
  | "AI_GATEWAY_API_KEY"
  | "BOTTLE_CLASSIFIER_MODEL"
  | "BOTTLE_CLASSIFIER_REASONING_EFFORT"
  | "NODE_ENV"
  | "OPENAI_EVAL_MODEL"
  | "OPENAI_EVAL_REASONING_EFFORT"
  | "OPENAI_EMBEDDING_MODEL"
  | "OPENAI_IMAGE_EXTRACTION_MODEL"
  | "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT"
  | "OPENAI_MODEL"
  | "OPENAI_REASONING_EFFORT";

export type OpenAICompatibleConfig = {
  apiKey: string | undefined;
  baseURL: string;
  bottleClassifierModel: string;
  bottleClassifierReasoningEffort: OpenAIReasoningEffort | undefined;
  embeddingModel: string;
  evalModel: string;
  evalReasoningEffort: OpenAIReasoningEffort | undefined;
  imageExtractionModel: string;
  imageExtractionReasoningEffort: OpenAIReasoningEffort | undefined;
  model: string;
  reasoningEffort: OpenAIReasoningEffort | undefined;
};

function gatewayModel(model: string): string {
  return model.includes("/") ? model : `openai/${model}`;
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function envValue(
  env: object,
  key: OpenAICompatibleEnvKey,
): string | undefined {
  const value = Reflect.get(env, key);
  return typeof value === "string" ? value : undefined;
}

export function resolveOpenAICompatibleConfig(
  env: object,
): OpenAICompatibleConfig {
  const gatewayApiKey = nonEmpty(envValue(env, "AI_GATEWAY_API_KEY"));
  const isProduction = nonEmpty(envValue(env, "NODE_ENV")) === "production";

  // Every hosted model call is owned by Vercel AI Gateway. Production fails at
  // startup instead of silently running with missing gateway credentials.
  if (isProduction && !gatewayApiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required in production");
  }

  const bottleClassifierModel =
    nonEmpty(envValue(env, "BOTTLE_CLASSIFIER_MODEL")) ??
    DEFAULT_BOTTLE_CLASSIFIER_MODEL;
  const model = nonEmpty(envValue(env, "OPENAI_MODEL")) ?? DEFAULT_OPENAI_MODEL;
  const evalModel =
    nonEmpty(envValue(env, "OPENAI_EVAL_MODEL")) ?? DEFAULT_OPENAI_EVAL_MODEL;
  const embeddingModel =
    nonEmpty(envValue(env, "OPENAI_EMBEDDING_MODEL")) ??
    DEFAULT_OPENAI_EMBEDDING_MODEL;
  const imageExtractionModel =
    nonEmpty(envValue(env, "OPENAI_IMAGE_EXTRACTION_MODEL")) ??
    DEFAULT_OPENAI_IMAGE_EXTRACTION_MODEL;

  return {
    apiKey: gatewayApiKey,
    baseURL: VERCEL_AI_GATEWAY_BASE_URL,
    bottleClassifierModel: gatewayModel(bottleClassifierModel),
    bottleClassifierReasoningEffort: parseOpenAIReasoningEffort(
      nonEmpty(envValue(env, "BOTTLE_CLASSIFIER_REASONING_EFFORT")) ??
        DEFAULT_BOTTLE_CLASSIFIER_REASONING_EFFORT,
    ),
    embeddingModel: gatewayModel(embeddingModel),
    evalModel: gatewayModel(evalModel),
    evalReasoningEffort: parseOpenAIReasoningEffort(
      envValue(env, "OPENAI_EVAL_REASONING_EFFORT") ??
        DEFAULT_OPENAI_EVAL_REASONING_EFFORT,
      "OPENAI_EVAL_REASONING_EFFORT",
    ),
    imageExtractionModel: gatewayModel(imageExtractionModel),
    imageExtractionReasoningEffort: parseOpenAIReasoningEffort(
      envValue(env, "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT") ??
        DEFAULT_OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
      "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT",
    ),
    model: gatewayModel(model),
    reasoningEffort: parseOpenAIReasoningEffort(
      envValue(env, "OPENAI_REASONING_EFFORT"),
    ),
  };
}
