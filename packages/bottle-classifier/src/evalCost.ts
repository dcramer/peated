import type { BottleClassifierRunMetadata } from "./runtime/runMetadata";

const PRICING_EFFECTIVE_DATE = "2026-08-01";
const PRICING_SOURCE_URL = "https://developers.openai.com/api/docs/pricing";
const TOKENS_PER_MILLION = 1_000_000;

type TokenPricing = {
  model: string;
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  cacheWriteUsdPerMillion?: number;
  outputUsdPerMillion: number;
};

type EvalTokenUsage = {
  requests: number;
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
};

const STANDARD_SHORT_CONTEXT_PRICING: TokenPricing[] = [
  {
    model: "gpt-5.6-terra",
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.2,
    cacheWriteUsdPerMillion: 2.5,
    outputUsdPerMillion: 12,
  },
  {
    model: "gpt-5.6-luna",
    inputUsdPerMillion: 0.2,
    cachedInputUsdPerMillion: 0.02,
    cacheWriteUsdPerMillion: 0.25,
    outputUsdPerMillion: 1.2,
  },
  {
    model: "gpt-5.6-sol",
    inputUsdPerMillion: 5,
    cachedInputUsdPerMillion: 0.5,
    cacheWriteUsdPerMillion: 6.25,
    outputUsdPerMillion: 30,
  },
  {
    model: "gpt-5.4",
    inputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 0.25,
    outputUsdPerMillion: 15,
  },
];

export type EvalRunCostMetadata = {
  scope: "agent_loop_only" | "full_llm_run";
  costCoverage:
    | "priced_model_tokens"
    | "cached_input_unreported_assumed_uncached"
    | "cache_write_unreported_assumed_standard_input"
    | "cache_details_unreported_assumed_standard_input"
    | "usage_unavailable"
    | "unsupported_model";
  estimatedAgentLoopCostUsd?: number;
  estimatedLlmRunCostUsd?: number;
  pricingModel?: string;
  pricingEffectiveDate: string;
  pricingSource: string;
  pricingBasis: "standard_short_context";
};

export type EvalModelCostMetadata = Omit<
  EvalRunCostMetadata,
  "scope" | "estimatedAgentLoopCostUsd"
> & {
  scope: "image_extraction_only";
  estimatedCostUsd?: number;
};

function unqualifiedModel(model: string): string {
  return model.toLowerCase().split("/").at(-1) ?? model;
}

function isModelOrSnapshot(model: string, pricedModel: string): boolean {
  if (model === pricedModel) {
    return true;
  }

  const snapshotPrefix = `${pricedModel}-`;
  return (
    model.startsWith(snapshotPrefix) &&
    /^\d{4}-\d{2}-\d{2}$/.test(model.slice(snapshotPrefix.length))
  );
}

function resolveTokenPricing(model: string): TokenPricing | undefined {
  const normalized = unqualifiedModel(model);

  if (isModelOrSnapshot(normalized, "gpt-5.6")) {
    return STANDARD_SHORT_CONTEXT_PRICING.find(
      (pricing) => pricing.model === "gpt-5.6-sol",
    );
  }

  return STANDARD_SHORT_CONTEXT_PRICING.find((pricing) =>
    isModelOrSnapshot(normalized, pricing.model),
  );
}

/**
 * Estimates the measured model tokens in the supplied usage scope. Provider
 * tool fees and pricing adjustments remain outside the token estimate.
 */
export function getEvalRunCostMetadata({
  model,
  usage,
  scope = "agent_loop_only",
}: {
  model: string;
  usage: BottleClassifierRunMetadata["usage"];
  scope?: EvalRunCostMetadata["scope"];
}): EvalRunCostMetadata {
  const metadata = getEvalModelCostMetadata({ model, usage });
  const { estimatedCostUsd, ...sharedMetadata } = metadata;
  return {
    ...sharedMetadata,
    scope,
    ...(estimatedCostUsd === undefined
      ? {}
      : scope === "full_llm_run"
        ? { estimatedLlmRunCostUsd: estimatedCostUsd }
        : { estimatedAgentLoopCostUsd: estimatedCostUsd }),
  };
}

export function getEvalModelCostMetadata({
  model,
  usage,
}: {
  model: string;
  usage: EvalTokenUsage;
}): EvalModelCostMetadata {
  const pricing = resolveTokenPricing(model);
  const baseMetadata = {
    scope: "image_extraction_only" as const,
    pricingEffectiveDate: PRICING_EFFECTIVE_DATE,
    pricingSource: PRICING_SOURCE_URL,
    pricingBasis: "standard_short_context" as const,
  };

  if (usage.requests === 0) {
    return { ...baseMetadata, costCoverage: "usage_unavailable" };
  }

  if (!pricing) {
    return { ...baseMetadata, costCoverage: "unsupported_model" };
  }

  const cachedInputTokens = Math.min(
    usage.inputTokens,
    usage.cachedInputTokens ?? 0,
  );
  const cacheWriteTokens = Math.min(
    usage.inputTokens - cachedInputTokens,
    usage.cacheWriteTokens ?? 0,
  );
  const standardInputTokens =
    usage.inputTokens - cachedInputTokens - cacheWriteTokens;
  const estimatedCostUsd =
    (standardInputTokens * pricing.inputUsdPerMillion +
      cachedInputTokens * pricing.cachedInputUsdPerMillion +
      cacheWriteTokens *
        (pricing.cacheWriteUsdPerMillion ?? pricing.inputUsdPerMillion) +
      usage.outputTokens * pricing.outputUsdPerMillion) /
    TOKENS_PER_MILLION;

  let costCoverage: EvalRunCostMetadata["costCoverage"] = "priced_model_tokens";
  if (
    usage.cachedInputTokens === undefined &&
    pricing.cacheWriteUsdPerMillion !== undefined &&
    usage.cacheWriteTokens === undefined
  ) {
    costCoverage = "cache_details_unreported_assumed_standard_input";
  } else if (usage.cachedInputTokens === undefined) {
    costCoverage = "cached_input_unreported_assumed_uncached";
  } else if (
    pricing.cacheWriteUsdPerMillion !== undefined &&
    usage.cacheWriteTokens === undefined
  ) {
    costCoverage = "cache_write_unreported_assumed_standard_input";
  }

  return {
    ...baseMetadata,
    costCoverage,
    estimatedCostUsd,
    pricingModel: pricing.model,
  };
}
