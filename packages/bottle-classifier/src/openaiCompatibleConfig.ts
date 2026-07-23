import {
  DEFAULT_OPENAI_EVAL_MODEL,
  DEFAULT_OPENAI_MODEL,
} from "./openaiModelSettings";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";

type OpenAICompatibleEnv = Readonly<
  Partial<
    Record<
      | "AI_GATEWAY_API_KEY"
      | "OPENAI_API_KEY"
      | "OPENAI_EVAL_MODEL"
      | "OPENAI_EMBEDDING_MODEL"
      | "OPENAI_HOST"
      | "OPENAI_MODEL"
      | "OPENAI_ORGANIZATION"
      | "OPENAI_PROJECT",
      string | undefined
    >
  >
>;

export type OpenAICompatibleConfig = {
  apiKey: string | undefined;
  baseURL: string;
  embeddingModel: string;
  evalModel: string;
  model: string;
  organization: string | undefined;
  project: string | undefined;
  provider: "openai" | "vercel-ai-gateway";
};

function gatewayModel(model: string): string {
  return model.includes("/") ? model : `openai/${model}`;
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveOpenAICompatibleConfig(
  env: OpenAICompatibleEnv,
): OpenAICompatibleConfig {
  const gatewayApiKey = nonEmpty(env.AI_GATEWAY_API_KEY);
  const usesGateway = Boolean(gatewayApiKey);
  const model = nonEmpty(env.OPENAI_MODEL) ?? DEFAULT_OPENAI_MODEL;
  const evalModel =
    nonEmpty(env.OPENAI_EVAL_MODEL) ?? DEFAULT_OPENAI_EVAL_MODEL;
  const embeddingModel =
    nonEmpty(env.OPENAI_EMBEDDING_MODEL) ?? DEFAULT_OPENAI_EMBEDDING_MODEL;

  return {
    apiKey: gatewayApiKey ?? nonEmpty(env.OPENAI_API_KEY),
    baseURL: usesGateway
      ? VERCEL_AI_GATEWAY_BASE_URL
      : (nonEmpty(env.OPENAI_HOST) ?? OPENAI_BASE_URL),
    embeddingModel: usesGateway ? gatewayModel(embeddingModel) : embeddingModel,
    evalModel: usesGateway ? gatewayModel(evalModel) : evalModel,
    model: usesGateway ? gatewayModel(model) : model,
    organization: usesGateway ? undefined : nonEmpty(env.OPENAI_ORGANIZATION),
    project: usesGateway ? undefined : nonEmpty(env.OPENAI_PROJECT),
    provider: usesGateway ? "vercel-ai-gateway" : "openai",
  };
}
