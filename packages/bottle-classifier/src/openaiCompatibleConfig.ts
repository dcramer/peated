import {
  DEFAULT_OPENAI_EVAL_MODEL,
  DEFAULT_OPENAI_EVAL_REASONING_EFFORT,
  DEFAULT_OPENAI_IMAGE_EXTRACTION_MODEL,
  DEFAULT_OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
  DEFAULT_OPENAI_MODEL,
  parseOpenAIReasoningEffort,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";

type OpenAICompatibleEnvKey =
  | "AI_GATEWAY_API_KEY"
  | "OPENAI_API_KEY"
  | "OPENAI_EVAL_MODEL"
  | "OPENAI_EVAL_REASONING_EFFORT"
  | "OPENAI_EMBEDDING_MODEL"
  | "OPENAI_HOST"
  | "OPENAI_IMAGE_EXTRACTION_MODEL"
  | "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT"
  | "OPENAI_MODEL"
  | "OPENAI_ORGANIZATION"
  | "OPENAI_PROJECT"
  | "OPENAI_REASONING_EFFORT";

export type OpenAICompatibleConfig = {
  apiKey: string | undefined;
  baseURL: string;
  embeddingModel: string;
  evalModel: string;
  evalReasoningEffort: OpenAIReasoningEffort | undefined;
  imageExtractionModel: string;
  imageExtractionReasoningEffort: OpenAIReasoningEffort | undefined;
  model: string;
  organization: string | undefined;
  project: string | undefined;
  provider: "openai" | "vercel-ai-gateway";
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
  const usesGateway = Boolean(gatewayApiKey);
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
    apiKey: gatewayApiKey ?? nonEmpty(envValue(env, "OPENAI_API_KEY")),
    baseURL: usesGateway
      ? VERCEL_AI_GATEWAY_BASE_URL
      : (nonEmpty(envValue(env, "OPENAI_HOST")) ?? OPENAI_BASE_URL),
    embeddingModel: usesGateway ? gatewayModel(embeddingModel) : embeddingModel,
    evalModel: usesGateway ? gatewayModel(evalModel) : evalModel,
    evalReasoningEffort: parseOpenAIReasoningEffort(
      envValue(env, "OPENAI_EVAL_REASONING_EFFORT") ??
        DEFAULT_OPENAI_EVAL_REASONING_EFFORT,
      "OPENAI_EVAL_REASONING_EFFORT",
    ),
    imageExtractionModel: usesGateway
      ? gatewayModel(imageExtractionModel)
      : imageExtractionModel,
    imageExtractionReasoningEffort: parseOpenAIReasoningEffort(
      envValue(env, "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT") ??
        DEFAULT_OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
      "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT",
    ),
    model: usesGateway ? gatewayModel(model) : model,
    organization: usesGateway
      ? undefined
      : nonEmpty(envValue(env, "OPENAI_ORGANIZATION")),
    project: usesGateway
      ? undefined
      : nonEmpty(envValue(env, "OPENAI_PROJECT")),
    provider: usesGateway ? "vercel-ai-gateway" : "openai",
    reasoningEffort: parseOpenAIReasoningEffort(
      envValue(env, "OPENAI_REASONING_EFFORT"),
    ),
  };
}
