import type { JsonValue, UsageSummary } from "vitest-evals/harness";
import { getEvalRunCostMetadata } from "./evalCost";
import type { BottleClassifierRunMetadata } from "./runtime/runMetadata";

export function buildEvalHarnessMeasurements({
  model,
  modelMetadata,
  totalMs,
}: {
  model: string;
  modelMetadata: BottleClassifierRunMetadata | null;
  totalMs: number;
}) {
  const costMetadata = modelMetadata
    ? getEvalRunCostMetadata({ model, usage: modelMetadata.usage })
    : null;

  return {
    usage: modelMetadata
      ? {
          provider: "openai",
          model,
          inputTokens: modelMetadata.usage.inputTokens,
          outputTokens: modelMetadata.usage.outputTokens,
          totalTokens: modelMetadata.usage.totalTokens,
          toolCalls: modelMetadata.toolCalls.count,
          metadata: {
            ...costMetadata,
            requests: modelMetadata.usage.requests,
            ...(modelMetadata.usage.cachedInputTokens === undefined
              ? {}
              : { cachedInputTokens: modelMetadata.usage.cachedInputTokens }),
            ...(modelMetadata.usage.cacheWriteTokens === undefined
              ? {}
              : { cacheWriteTokens: modelMetadata.usage.cacheWriteTokens }),
            toolNames: modelMetadata.toolCalls.names,
          } satisfies Record<string, JsonValue>,
        }
      : undefined,
    timings: {
      totalMs,
      ...(modelMetadata
        ? { metadata: { agentDurationMs: modelMetadata.agentDurationMs } }
        : {}),
    },
  };
}

export function formatEvalUsageAnnotation(
  usage: UsageSummary | undefined,
): string {
  const metadata = usage?.metadata;
  const estimate = metadata?.estimatedAgentLoopCostUsd;
  const coverage = metadata?.costCoverage ?? "usage_unavailable";
  if (coverage === "usage_unavailable") {
    return "usage unavailable · agent loop only";
  }

  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const tokenSummary = `input ${inputTokens.toLocaleString("en-US")} tok | output ${outputTokens.toLocaleString("en-US")} tok`;

  if (typeof estimate === "number") {
    return `${tokenSummary} | est. $${estimate.toFixed(6)} · agent loop only`;
  }

  return `${tokenSummary} | cost unavailable (unsupported model) · agent loop only`;
}
