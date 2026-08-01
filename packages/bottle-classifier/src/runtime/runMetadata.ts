import { z } from "zod";

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
        totalTokens: NonnegativeIntegerSchema,
      })
      .strict(),
    toolCalls: z
      .object({
        count: NonnegativeIntegerSchema,
        names: z.array(z.string().trim().min(1)),
      })
      .strict(),
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

function inputTokenDetail(usage: unknown, keys: string[]): number | undefined {
  const details = objectProperty(usage, "inputTokensDetails");
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
}: {
  result: unknown;
  durationMs: number;
}): BottleClassifierRunMetadata {
  const usage =
    objectProperty(objectProperty(result, "state"), "usage") ??
    objectProperty(objectProperty(result, "runContext"), "usage") ??
    objectProperty(result, "usage");
  const measuredCachedInputTokens = inputTokenDetail(usage, [
    "cached_tokens",
    "cachedTokens",
  ]);
  const measuredCacheWriteTokens = inputTokenDetail(usage, [
    "cache_write_tokens",
    "cacheWriteTokens",
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

  return BottleClassifierRunMetadataSchema.parse({
    agentDurationMs: Math.max(0, Math.round(durationMs)),
    usage: {
      requests: numberProperty(usage, "requests"),
      inputTokens: numberProperty(usage, "inputTokens"),
      ...(measuredCachedInputTokens === undefined
        ? {}
        : { cachedInputTokens: measuredCachedInputTokens }),
      ...(measuredCacheWriteTokens === undefined
        ? {}
        : { cacheWriteTokens: measuredCacheWriteTokens }),
      outputTokens: numberProperty(usage, "outputTokens"),
      totalTokens: numberProperty(usage, "totalTokens"),
    },
    toolCalls: {
      count: toolCallCount,
      names: toolNames,
    },
  });
}
