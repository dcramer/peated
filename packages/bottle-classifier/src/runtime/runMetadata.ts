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

function objectProperty(value: unknown, property: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[property]
    : undefined;
}

function numberProperty(value: unknown, property: string): number {
  const candidate = objectProperty(value, property);
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : 0;
}

function tokenDetail(
  usage: unknown,
  detailsProperty: string,
  keys: string[],
): number | undefined {
  const details = objectProperty(usage, detailsProperty);
  const entries = Array.isArray(details) ? details : details ? [details] : [];
  let measured = false;
  let total = 0;

  for (const entry of entries) {
    const value = keys.reduce<unknown>(
      (found, key) => found ?? objectProperty(entry, key),
      undefined,
    );
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      measured = true;
      total += value;
    }
  }

  return measured ? Math.round(total) : undefined;
}

function stringProperty(value: unknown, property: string): string | null {
  const candidate = objectProperty(value, property);
  return typeof candidate === "string" ? candidate : null;
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
  const usage =
    objectProperty(objectProperty(result, "state"), "usage") ??
    objectProperty(objectProperty(result, "runContext"), "usage") ??
    objectProperty(result, "usage");
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
  const newItems = objectProperty(result, "newItems");

  if (Array.isArray(newItems)) {
    for (const item of newItems) {
      if (stringProperty(item, "type") !== "tool_call_output_item") {
        continue;
      }

      toolCallCount += 1;
      const rawItem = objectProperty(item, "rawItem");
      const name =
        stringProperty(rawItem, "name") ?? stringProperty(item, "name");
      if (name) {
        toolNames.push(name);
      }
    }
  }

  const normalizedUsage = {
    requests: numberProperty(usage, "requests"),
    inputTokens: numberProperty(usage, "inputTokens"),
    ...(measuredCachedInputTokens === undefined
      ? {}
      : { cachedInputTokens: measuredCachedInputTokens }),
    ...(measuredCacheWriteTokens === undefined
      ? {}
      : { cacheWriteTokens: measuredCacheWriteTokens }),
    outputTokens: numberProperty(usage, "outputTokens"),
    ...(measuredReasoningTokens === undefined
      ? {}
      : { reasoningTokens: measuredReasoningTokens }),
    totalTokens: numberProperty(usage, "totalTokens"),
  };

  return BottleClassifierRunMetadataSchema.parse({
    agentDurationMs: Math.max(0, Math.round(durationMs)),
    usage: normalizedUsage,
    toolCalls: {
      count: toolCallCount,
      names: toolNames,
    },
    ...(model
      ? {
          cost: getRunCostMetadata({
            model,
            usage: normalizedUsage,
          }),
        }
      : {}),
  });
}
