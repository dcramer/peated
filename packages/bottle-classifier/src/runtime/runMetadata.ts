import { z } from "zod";
import type { AgentRunResult } from "./agentRun";
import { getRunCostMetadata } from "./cost";

const NonnegativeIntegerSchema = z.number().int().nonnegative();

export const BottleClassifierRunMetadataSchema = z
  .object({
    agentDurationMs: NonnegativeIntegerSchema,
    usage: z
      .object({
        requests: NonnegativeIntegerSchema,
        inputTokens: NonnegativeIntegerSchema,
        cachedInputTokens: NonnegativeIntegerSchema.optional(),
        cacheWriteTokens: NonnegativeIntegerSchema.optional(),
        outputTokens: NonnegativeIntegerSchema,
        reasoningTokens: NonnegativeIntegerSchema.optional(),
        totalTokens: NonnegativeIntegerSchema,
      })
      .strict(),
    toolCalls: z
      .object({
        count: NonnegativeIntegerSchema,
        names: z.array(z.string().trim().min(1)),
      })
      .strict(),
    cost: z
      .object({
        scope: z.literal("agent_loop_only"),
        costCoverage: z.enum([
          "priced_model_tokens",
          "cached_input_unreported_assumed_uncached",
          "cache_write_unreported_assumed_standard_input",
          "cache_details_unreported_assumed_standard_input",
          "usage_unavailable",
          "unsupported_model",
        ]),
        estimatedAgentLoopCostUsd: z.number().nonnegative().optional(),
        pricingModel: z.string().trim().min(1).optional(),
        pricingEffectiveDate: z.iso.date(),
        pricingSource: z.url(),
        pricingBasis: z.literal("standard_short_context"),
      })
      .strict()
      .optional(),
  })
  .strict();

export type BottleClassifierRunMetadata = z.infer<
  typeof BottleClassifierRunMetadataSchema
>;

function tokenCount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

/**
 * Extracts the stable, JSON-safe measurements needed by Bottle-check rollout
 * reports without persisting provider response bodies.
 */
export function getBottleClassifierRunMetadata({
  result,
  durationMs,
  model,
}: {
  result: AgentRunResult;
  durationMs: number;
  model?: string;
}): BottleClassifierRunMetadata {
  const { usage } = result;
  const measuredCachedInputTokens = tokenCount(usage.cachedInputTokens);
  const measuredCacheWriteTokens = tokenCount(usage.cacheWriteTokens);
  const measuredReasoningTokens = tokenCount(usage.reasoningTokens);
  const toolNames = result.toolResults.map((toolResult) => toolResult.name);
  const toolCallCount = toolNames.length;

  const normalizedUsage: BottleClassifierRunMetadata["usage"] = {
    requests: tokenCount(usage.requests) ?? 0,
    inputTokens: tokenCount(usage.inputTokens) ?? 0,
    outputTokens: tokenCount(usage.outputTokens) ?? 0,
    totalTokens: tokenCount(usage.totalTokens) ?? 0,
  };
  if (measuredCachedInputTokens !== undefined) {
    normalizedUsage.cachedInputTokens = measuredCachedInputTokens;
  }
  if (measuredCacheWriteTokens !== undefined) {
    normalizedUsage.cacheWriteTokens = measuredCacheWriteTokens;
  }
  if (measuredReasoningTokens !== undefined) {
    normalizedUsage.reasoningTokens = measuredReasoningTokens;
  }

  const metadata: BottleClassifierRunMetadata = {
    agentDurationMs: Math.max(0, Math.round(durationMs)),
    usage: normalizedUsage,
    toolCalls: {
      count: toolCallCount,
      names: toolNames,
    },
  };
  if (model) {
    const cost = getRunCostMetadata({
      model,
      usage: normalizedUsage,
    });
    if (cost.scope !== "agent_loop_only") {
      throw new Error("Agent metadata requires agent-loop cost scope.");
    }
    metadata.cost = { ...cost, scope: "agent_loop_only" };
  }
  return BottleClassifierRunMetadataSchema.parse(metadata);
}
