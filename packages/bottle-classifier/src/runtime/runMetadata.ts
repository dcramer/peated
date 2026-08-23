import { z } from "zod";
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

const TokenDetailsSchema = z.union([
  z.record(z.string(), z.number()),
  z.array(z.record(z.string(), z.number())),
]);
const RunUsageSchema = z
  .object({
    requests: z.number().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    inputTokensDetails: TokenDetailsSchema.optional(),
    outputTokensDetails: TokenDetailsSchema.optional(),
  })
  .passthrough();
const UsageOwnerSchema = z
  .object({ usage: RunUsageSchema.optional() })
  .passthrough();
const ToolItemSchema = z
  .object({
    type: z.string().optional(),
    name: z.string().optional(),
    rawItem: z
      .object({
        name: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
const RunResultSchema = z
  .object({
    state: UsageOwnerSchema.optional(),
    runContext: UsageOwnerSchema.optional(),
    usage: RunUsageSchema.optional(),
    newItems: z.array(ToolItemSchema).optional(),
  })
  .passthrough();
type RunUsage = z.infer<typeof RunUsageSchema>;
type UsageNumberProperty =
  | "inputTokens"
  | "outputTokens"
  | "requests"
  | "totalTokens";
type UsageDetailsProperty = "inputTokensDetails" | "outputTokensDetails";

function numberProperty(
  usage: RunUsage | undefined,
  property: UsageNumberProperty,
): number {
  const candidate = usage?.[property];
  const measured = z.number().finite().safeParse(candidate);
  return measured.success ? measured.data : 0;
}

function tokenDetail(
  usage: RunUsage | undefined,
  detailsProperty: UsageDetailsProperty,
  keys: string[],
): number | undefined {
  const details = usage?.[detailsProperty];
  const entries = Array.isArray(details) ? details : details ? [details] : [];
  let measured = false;
  let total = 0;

  for (const entry of entries) {
    const value = keys.reduce<number | undefined>(
      (found, key) => found ?? entry[key],
      undefined,
    );
    const measuredValue = z.number().finite().nonnegative().safeParse(value);
    if (measuredValue.success) {
      measured = true;
      total += measuredValue.data;
    }
  }

  return measured ? Math.round(total) : undefined;
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
  result: unknown;
  durationMs: number;
  model?: string;
}): BottleClassifierRunMetadata {
  const parsedResult = RunResultSchema.safeParse(result);
  const runResult = parsedResult.success ? parsedResult.data : {};
  const usage =
    runResult.state?.usage ?? runResult.runContext?.usage ?? runResult.usage;
  const measuredCachedInputTokens = tokenDetail(usage, "inputTokensDetails", [
    "cached_tokens",
    "cachedTokens",
  ]);
  const measuredCacheWriteTokens = tokenDetail(usage, "inputTokensDetails", [
    "cache_write_tokens",
    "cacheWriteTokens",
  ]);
  const measuredReasoningTokens = tokenDetail(usage, "outputTokensDetails", [
    "reasoning_tokens",
    "reasoningTokens",
  ]);
  const toolNames: string[] = [];
  let toolCallCount = 0;
  const newItems = runResult.newItems;

  if (Array.isArray(newItems)) {
    for (const item of newItems) {
      if (item.type !== "tool_call_output_item") {
        continue;
      }

      toolCallCount += 1;
      const name = item.rawItem?.name ?? item.name;
      if (name) {
        toolNames.push(name);
      }
    }
  }

  const normalizedUsage: BottleClassifierRunMetadata["usage"] = {
    requests: numberProperty(usage, "requests"),
    inputTokens: numberProperty(usage, "inputTokens"),
    outputTokens: numberProperty(usage, "outputTokens"),
    totalTokens: numberProperty(usage, "totalTokens"),
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
