import type { JsonValue, UsageSummary } from "vitest-evals/harness";
import { z } from "zod";
import {
  buildEvalModelCallTrace,
  summarizeEvalModelCalls,
  type EvalModelCall,
} from "./evalTelemetry";
import type { WhiskyLabelExtractionMetadata } from "./extractor";
import type { OpenAIReasoningEffort } from "./openaiModelSettings";
import { getModelCostMetadata, getRunCostMetadata } from "./runtime/cost";
import type { BottleClassifierRunMetadata } from "./runtime/runMetadata";

interface EvalUsageMetadata {
  [key: string]: JsonValue;
}

interface EvalTimings {
  totalMs: number;
  metadata?: { agentDurationMs: number };
}

interface EvalMeasurements {
  usage: UsageSummary | undefined;
  timings: EvalTimings;
  traces?: ReturnType<typeof buildEvalModelCallTrace>;
}

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
  let measuredUsage = modelMetadata?.usage;
  if (capturedUsage?.inputTokens !== undefined) {
    const capturedModelUsage: BottleClassifierRunMetadata["usage"] = {
      requests: modelCalls?.length ?? 0,
      inputTokens: capturedUsage.inputTokens,
      outputTokens: capturedUsage.outputTokens ?? 0,
      totalTokens: capturedUsage.totalTokens ?? 0,
    };
    const cachedInputTokens = z
      .number()
      .safeParse(capturedUsage.metadata?.cachedInputTokens);
    if (cachedInputTokens.success) {
      capturedModelUsage.cachedInputTokens = cachedInputTokens.data;
    }
    const cacheWriteTokens = z
      .number()
      .safeParse(capturedUsage.metadata?.cacheWriteTokens);
    if (cacheWriteTokens.success) {
      capturedModelUsage.cacheWriteTokens = cacheWriteTokens.data;
    }
    measuredUsage = capturedModelUsage;
  }
  const usageScope =
    capturedUsage?.inputTokens === undefined
      ? "agent_loop_only"
      : "full_llm_run";
  const costMetadata = measuredUsage
    ? getRunCostMetadata({ model, usage: measuredUsage, scope: usageScope })
    : null;
  let usage: UsageSummary | undefined;
  if (measuredUsage) {
    const usageMetadata: EvalUsageMetadata = {
      ...costMetadata,
      reasoningEffort: reasoningEffort ?? "provider_default",
      requests: measuredUsage.requests,
      toolNames: modelMetadata?.toolCalls.names ?? [],
    };
    if (measuredUsage.cachedInputTokens !== undefined) {
      usageMetadata.cachedInputTokens = measuredUsage.cachedInputTokens;
    }
    if (measuredUsage.cacheWriteTokens !== undefined) {
      usageMetadata.cacheWriteTokens = measuredUsage.cacheWriteTokens;
    }
    if (capturedUsage?.metadata?.models) {
      usageMetadata.models = capturedUsage.metadata.models;
    }

    usage = {
      provider: "openai",
      model: capturedUsage?.model ?? model,
      inputTokens: measuredUsage.inputTokens,
      outputTokens: measuredUsage.outputTokens,
      totalTokens: measuredUsage.totalTokens,
      toolCalls: modelMetadata?.toolCalls.count ?? 0,
      metadata: usageMetadata,
    };
    const reasoningTokens =
      capturedUsage?.reasoningTokens ?? modelMetadata?.usage.reasoningTokens;
    if (reasoningTokens !== undefined) {
      usage.reasoningTokens = reasoningTokens;
    }
  }

  const timings: EvalTimings = { totalMs };
  if (modelMetadata) {
    timings.metadata = { agentDurationMs: modelMetadata.agentDurationMs };
  }
  const measurements: EvalMeasurements = {
    usage,
    timings,
  };
  if (trace && modelCalls) {
    measurements.traces = buildEvalModelCallTrace({ ...trace, modelCalls });
  }
  return measurements;
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
  const normalizedUsage: Pick<
    BottleClassifierRunMetadata["usage"],
    "requests" | "inputTokens" | "cachedInputTokens" | "outputTokens"
  > = {
    requests: usage ? 1 : 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  };
  if (usage) normalizedUsage.cachedInputTokens = usage.cachedInputTokens;
  const costMetadata = getModelCostMetadata({
    model,
    usage: normalizedUsage,
  });

  const usageMetadata: EvalUsageMetadata = {
    ...costMetadata,
    reasoningEffort: reasoningEffort ?? "provider_default",
    requests: normalizedUsage.requests,
  };
  if (usage) {
    usageMetadata.cachedInputTokens = usage.cachedInputTokens;
    usageMetadata.reasoningTokens = usage.reasoningTokens;
  }

  return {
    usage: {
      provider: "openai",
      model,
      inputTokens: normalizedUsage.inputTokens,
      outputTokens: normalizedUsage.outputTokens,
      totalTokens: usage?.totalTokens ?? 0,
      toolCalls: 0,
      metadata: usageMetadata,
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
  const parsedReasoningEffort = z.string().safeParse(metadata?.reasoningEffort);
  const reasoningEffort = parsedReasoningEffort.success
    ? parsedReasoningEffort.data
    : "provider_default";
  const reasoningSummary = `effort ${reasoningEffort.replace("_", " ")}`;
  if (coverage === "usage_unavailable") {
    return `usage unavailable | ${reasoningSummary} · ${scopeLabel}`;
  }

  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const reportedCachedInputTokens = metadata?.cachedInputTokens;
  const parsedCachedInputTokens = z
    .number()
    .safeParse(reportedCachedInputTokens);
  const cachedInputTokens = parsedCachedInputTokens.success
    ? Math.min(inputTokens, Math.max(0, parsedCachedInputTokens.data))
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

  const parsedEstimate = z.number().safeParse(estimate);
  if (parsedEstimate.success) {
    return `${tokenSummary} | ${reasoningSummary} | est. $${parsedEstimate.data.toFixed(6)} · ${scopeLabel}`;
  }

  return `${tokenSummary} | ${reasoningSummary} | cost unavailable (unsupported model) · ${scopeLabel}`;
}
