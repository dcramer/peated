import type { JsonValue, UsageSummary } from "vitest-evals/harness";
import { getEvalRunCostMetadata } from "./evalCost";
import type { OpenAIReasoningEffort } from "./openaiModelSettings";
import type { BottleClassifierRunMetadata } from "./runtime/runMetadata";

export function buildEvalHarnessMeasurements({
  model,
  modelMetadata,
  reasoningEffort,
  totalMs,
}: {
  model: string;
  modelMetadata: BottleClassifierRunMetadata | null;
  reasoningEffort?: OpenAIReasoningEffort;
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
            reasoningEffort: reasoningEffort ?? "provider_default",
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
  const reasoningEffort = metadata?.reasoningEffort ?? "provider_default";
  const reasoningSummary = `effort ${String(reasoningEffort).replace("_", " ")}`;
  if (coverage === "usage_unavailable") {
    return `usage unavailable | ${reasoningSummary} · agent loop only`;
  }

  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const reportedCachedInputTokens = metadata?.cachedInputTokens;
  const cachedInputTokens =
    typeof reportedCachedInputTokens === "number"
      ? Math.min(inputTokens, Math.max(0, reportedCachedInputTokens))
      : 0;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const comparisonTokens = uncachedInputTokens + outputTokens;
  const tokenSummary = [
    `uncached input ${uncachedInputTokens.toLocaleString("en-US")} tok`,
    `output ${outputTokens.toLocaleString("en-US")} tok`,
    `proxy total ${comparisonTokens.toLocaleString("en-US")} tok`,
    ...(cachedInputTokens > 0
      ? [`cached input ${cachedInputTokens.toLocaleString("en-US")} tok`]
      : []),
  ].join(" | ");

  if (typeof estimate === "number") {
    return `${tokenSummary} | ${reasoningSummary} | est. $${estimate.toFixed(6)} · agent loop only`;
  }

  return `${tokenSummary} | ${reasoningSummary} | cost unavailable (unsupported model) · agent loop only`;
}
