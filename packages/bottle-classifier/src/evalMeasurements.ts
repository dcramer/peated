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

export function formatEvalCostAnnotation(
  usage: UsageSummary | undefined,
): string {
  const metadata = usage?.metadata;
  const estimate = metadata?.estimatedAgentLoopCostUsd;
  const coverage = metadata?.costCoverage ?? "usage_unavailable";
  const coverageNote =
    coverage === "cached_input_unreported_assumed_uncached"
      ? "cached input estimated as standard input"
      : coverage === "cache_write_unreported_assumed_standard_input"
        ? "cache writes estimated as standard input"
        : coverage === "cache_details_unreported_assumed_standard_input"
          ? "cache details estimated as standard input"
          : null;

  if (typeof estimate === "number") {
    const estimateText = `$${estimate.toFixed(6)} estimated agent loop only`;
    return coverageNote ? `${estimateText} (${coverageNote})` : estimateText;
  }

  return coverage === "unsupported_model"
    ? "Agent-loop cost unavailable (unsupported model)"
    : "Agent-loop cost unavailable (usage unavailable)";
}
