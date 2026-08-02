import type { JsonValue, UsageSummary } from "vitest-evals/harness";
import { getEvalModelCostMetadata, getEvalRunCostMetadata } from "./evalCost";
import {
  buildEvalModelCallTrace,
  summarizeEvalModelCalls,
  type EvalModelCall,
} from "./evalTelemetry";
import type { WhiskyLabelExtractionMetadata } from "./extractor";
import type { OpenAIReasoningEffort } from "./openaiModelSettings";
import type { BottleClassifierRunMetadata } from "./runtime/runMetadata";

export function buildEvalHarnessMeasurements({
  model,
  modelMetadata,
  reasoningEffort,
  totalMs,
  modelCalls,
  trace,
}: {
  model: string;
  modelMetadata: BottleClassifierRunMetadata | null;
  reasoningEffort?: OpenAIReasoningEffort;
  totalMs: number;
  modelCalls?: EvalModelCall[];
  trace?: {
    name: string;
    operationName: "invoke_agent" | "invoke_workflow";
  };
}) {
  const capturedUsage = modelCalls
    ? summarizeEvalModelCalls(modelCalls)
    : undefined;
  const measuredUsage =
    capturedUsage?.inputTokens === undefined
      ? modelMetadata?.usage
      : {
          requests: modelCalls?.length ?? 0,
          inputTokens: capturedUsage.inputTokens,
          ...(typeof capturedUsage.metadata?.cachedInputTokens === "number"
            ? {
                cachedInputTokens: capturedUsage.metadata.cachedInputTokens,
              }
            : {}),
          ...(typeof capturedUsage.metadata?.cacheWriteTokens === "number"
            ? { cacheWriteTokens: capturedUsage.metadata.cacheWriteTokens }
            : {}),
          outputTokens: capturedUsage.outputTokens ?? 0,
          totalTokens: capturedUsage.totalTokens ?? 0,
        };
  const usageScope =
    capturedUsage?.inputTokens === undefined
      ? "agent_loop_only"
      : "full_llm_run";
  const costMetadata = measuredUsage
    ? getEvalRunCostMetadata({ model, usage: measuredUsage, scope: usageScope })
    : null;
  const usage = measuredUsage
    ? {
        provider: "openai",
        model: capturedUsage?.model ?? model,
        inputTokens: measuredUsage.inputTokens,
        outputTokens: measuredUsage.outputTokens,
        ...((capturedUsage?.reasoningTokens ??
          modelMetadata?.usage.reasoningTokens) === undefined
          ? {}
          : {
              reasoningTokens:
                capturedUsage?.reasoningTokens ??
                modelMetadata?.usage.reasoningTokens,
            }),
        totalTokens: measuredUsage.totalTokens,
        toolCalls: modelMetadata?.toolCalls.count ?? 0,
        metadata: {
          ...costMetadata,
          reasoningEffort: reasoningEffort ?? "provider_default",
          requests: measuredUsage.requests,
          ...(measuredUsage.cachedInputTokens === undefined
            ? {}
            : { cachedInputTokens: measuredUsage.cachedInputTokens }),
          ...(measuredUsage.cacheWriteTokens === undefined
            ? {}
            : { cacheWriteTokens: measuredUsage.cacheWriteTokens }),
          toolNames: modelMetadata?.toolCalls.names ?? [],
          ...(capturedUsage?.metadata?.models
            ? { models: capturedUsage.metadata.models }
            : {}),
        } satisfies Record<string, JsonValue>,
      }
    : undefined;

  return {
    usage,
    timings: {
      totalMs,
      ...(modelMetadata
        ? { metadata: { agentDurationMs: modelMetadata.agentDurationMs } }
        : {}),
    },
    ...(trace && modelCalls
      ? {
          traces: buildEvalModelCallTrace({
            ...trace,
            modelCalls,
          }),
        }
      : {}),
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
    metadata?.estimatedCostUsd ??
    metadata?.estimatedLlmRunCostUsd ??
    metadata?.estimatedAgentLoopCostUsd;
  const scope = metadata?.scope ?? "agent_loop_only";
  const scopeLabel =
    scope === "image_extraction_only"
      ? "image extraction only"
      : scope === "full_llm_run"
        ? "full LLM run"
        : "agent loop only";
  const coverage = metadata?.costCoverage ?? "usage_unavailable";
  const reasoningEffort =
    typeof metadata?.reasoningEffort === "string"
      ? metadata.reasoningEffort
      : "provider_default";
  const reasoningSummary = `effort ${reasoningEffort.replace("_", " ")}`;
  if (coverage === "usage_unavailable") {
    return `usage unavailable | ${reasoningSummary} · ${scopeLabel}`;
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
    return `${tokenSummary} | ${reasoningSummary} | est. $${estimate.toFixed(6)} · ${scopeLabel}`;
  }

  return `${tokenSummary} | ${reasoningSummary} | cost unavailable (unsupported model) · ${scopeLabel}`;
}
