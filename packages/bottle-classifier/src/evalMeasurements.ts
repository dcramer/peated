import type { JsonValue, UsageSummary } from "vitest-evals/harness";
import { getEvalModelCostMetadata, getEvalRunCostMetadata } from "./evalCost";
import type { WhiskyLabelExtractionMetadata } from "./extractor";
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

export function buildImageExtractionEvalMeasurements({
  model,
  reasoningEffort,
  metadata,
}: {
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  metadata: WhiskyLabelExtractionMetadata;
}) {
  const usage = metadata.usage;
  const normalizedUsage = {
    requests: usage ? 1 : 0,
    inputTokens: usage?.inputTokens ?? 0,
    ...(usage ? { cachedInputTokens: usage.cachedInputTokens } : {}),
    outputTokens: usage?.outputTokens ?? 0,
  };
  const costMetadata = getEvalModelCostMetadata({
    model,
    usage: normalizedUsage,
  });

  return {
    usage: {
      provider: "openai",
      model,
      inputTokens: normalizedUsage.inputTokens,
      outputTokens: normalizedUsage.outputTokens,
      totalTokens: usage?.totalTokens ?? 0,
      toolCalls: 0,
      metadata: {
        ...costMetadata,
        reasoningEffort: reasoningEffort ?? "provider_default",
        requests: normalizedUsage.requests,
        ...(usage
          ? {
              cachedInputTokens: usage.cachedInputTokens,
              reasoningTokens: usage.reasoningTokens,
            }
          : {}),
      } satisfies Record<string, JsonValue>,
    },
    timings: {
      totalMs: metadata.durationMs,
      metadata: { imageExtractionDurationMs: metadata.durationMs },
    },
  };
}

export function formatEvalUsageAnnotation(
  usage: UsageSummary | undefined,
): string {
  const metadata = usage?.metadata;
  const estimate =
    metadata?.estimatedCostUsd ?? metadata?.estimatedAgentLoopCostUsd;
  const coverage = metadata?.costCoverage ?? "usage_unavailable";
  const reasoningEffort = metadata?.reasoningEffort ?? "provider_default";
  const reasoningSummary = `effort ${String(reasoningEffort).replace("_", " ")}`;
  const scopeSummary =
    metadata?.scope === "image_extraction_only"
      ? "image extraction only"
      : "agent loop only";
  if (coverage === "usage_unavailable") {
    return `usage unavailable | ${reasoningSummary} · ${scopeSummary}`;
  }

  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const tokenSummary = `input ${inputTokens.toLocaleString("en-US")} tok | output ${outputTokens.toLocaleString("en-US")} tok`;

  if (typeof estimate === "number") {
    return `${tokenSummary} | ${reasoningSummary} | est. $${estimate.toFixed(6)} · ${scopeSummary}`;
  }

  return `${tokenSummary} | ${reasoningSummary} | cost unavailable (unsupported model) · ${scopeSummary}`;
}
