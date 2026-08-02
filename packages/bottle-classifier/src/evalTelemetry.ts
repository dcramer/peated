import { AsyncLocalStorage } from "node:async_hooks";
import type {
  GenAiOperationName,
  SimpleTraceRecord,
  UsageSummary,
} from "vitest-evals/harness";

export type EvalModelCall = {
  operationName: "chat";
  providerName: "openai";
  requestModel: string;
  responseModel: string;
  responseId?: string;
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type EvalModelCallStore = {
  calls: EvalModelCall[];
};

const evalModelCallStorage = new AsyncLocalStorage<EvalModelCallStore>();
let nextEvalTraceId = 0;

function objectProperty(value: unknown, property: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[property]
    : undefined;
}

function finiteNonnegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function usageNumber(usage: unknown, ...properties: string[]): number {
  for (const property of properties) {
    const measured = finiteNonnegativeNumber(objectProperty(usage, property));
    if (measured !== undefined) {
      return measured;
    }
  }

  return 0;
}

function usageDetailNumber(
  usage: unknown,
  detailProperties: string[],
  valueProperties: string[],
): number | undefined {
  for (const detailProperty of detailProperties) {
    const details = objectProperty(usage, detailProperty);
    for (const valueProperty of valueProperties) {
      const measured = finiteNonnegativeNumber(
        objectProperty(details, valueProperty),
      );
      if (measured !== undefined) {
        return measured;
      }
    }
  }

  return undefined;
}

/** Normalizes one non-streaming OpenAI Responses result for eval reporting. */
export function getEvalModelCall({
  request,
  response,
  startedAt,
  finishedAt = new Date(),
}: {
  request: unknown;
  response: unknown;
  startedAt: Date;
  finishedAt?: Date;
}): EvalModelCall | null {
  const requestModel = objectProperty(request, "model");
  if (typeof requestModel !== "string" || requestModel.length === 0) {
    return null;
  }

  const responseModel = objectProperty(response, "model");
  const usage = objectProperty(response, "usage");
  const inputTokens = usageNumber(usage, "input_tokens", "inputTokens");
  const outputTokens = usageNumber(usage, "output_tokens", "outputTokens");
  const totalTokens = usageNumber(usage, "total_tokens", "totalTokens");
  const responseId = objectProperty(response, "id");

  return {
    operationName: "chat",
    providerName: "openai",
    requestModel,
    responseModel:
      typeof responseModel === "string" && responseModel.length > 0
        ? responseModel
        : requestModel,
    ...(typeof responseId === "string" && responseId.length > 0
      ? { responseId }
      : {}),
    inputTokens,
    ...(usageDetailNumber(
      usage,
      ["input_tokens_details", "inputTokensDetails"],
      ["cached_tokens", "cachedTokens"],
    ) === undefined
      ? {}
      : {
          cachedInputTokens: usageDetailNumber(
            usage,
            ["input_tokens_details", "inputTokensDetails"],
            ["cached_tokens", "cachedTokens"],
          ),
        }),
    ...(usageDetailNumber(
      usage,
      ["input_tokens_details", "inputTokensDetails"],
      ["cache_write_tokens", "cacheWriteTokens"],
    ) === undefined
      ? {}
      : {
          cacheWriteTokens: usageDetailNumber(
            usage,
            ["input_tokens_details", "inputTokensDetails"],
            ["cache_write_tokens", "cacheWriteTokens"],
          ),
        }),
    outputTokens,
    ...(usageDetailNumber(
      usage,
      ["output_tokens_details", "outputTokensDetails"],
      ["reasoning_tokens", "reasoningTokens"],
    ) === undefined
      ? {}
      : {
          reasoningTokens: usageDetailNumber(
            usage,
            ["output_tokens_details", "outputTokensDetails"],
            ["reasoning_tokens", "reasoningTokens"],
          ),
        }),
    totalTokens: totalTokens || inputTokens + outputTokens,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
  };
}

/** Records an OpenAI response when an eval model-call capture is active. */
export function recordEvalOpenAIResponse({
  request,
  response,
  startedAt,
  finishedAt,
  store = evalModelCallStorage.getStore(),
}: {
  request: unknown;
  response: unknown;
  startedAt: Date;
  finishedAt?: Date;
  store?: EvalModelCallStore;
}) {
  const call = getEvalModelCall({ request, response, startedAt, finishedAt });
  if (call && store) {
    store.calls.push(call);
  }
}

/** Captures every instrumented OpenAI Responses call made by one eval run. */
export async function withEvalModelCallCapture<T>(
  callback: () => Promise<T>,
): Promise<{ result: T; modelCalls: EvalModelCall[] }> {
  const store: EvalModelCallStore = { calls: [] };
  const result = await evalModelCallStorage.run(store, callback);
  return { result, modelCalls: store.calls };
}

/** Returns the active capture store for the eval OpenAI client wrapper. */
export function getActiveEvalModelCallStore() {
  return evalModelCallStorage.getStore();
}

export function summarizeEvalModelCalls(
  modelCalls: EvalModelCall[],
): UsageSummary {
  if (modelCalls.length === 0) {
    return {};
  }

  const models = new Set(modelCalls.map((call) => call.responseModel));
  const cachedInputTokens = modelCalls.reduce(
    (total, call) => total + (call.cachedInputTokens ?? 0),
    0,
  );
  const cacheWriteTokens = modelCalls.reduce(
    (total, call) => total + (call.cacheWriteTokens ?? 0),
    0,
  );
  const reasoningTokens = modelCalls.reduce(
    (total, call) => total + (call.reasoningTokens ?? 0),
    0,
  );

  return {
    provider: "openai",
    ...(models.size === 1 ? { model: modelCalls[0]?.responseModel } : {}),
    inputTokens: modelCalls.reduce(
      (total, call) => total + call.inputTokens,
      0,
    ),
    outputTokens: modelCalls.reduce(
      (total, call) => total + call.outputTokens,
      0,
    ),
    ...(modelCalls.some((call) => call.reasoningTokens !== undefined)
      ? { reasoningTokens }
      : {}),
    totalTokens: modelCalls.reduce(
      (total, call) => total + call.totalTokens,
      0,
    ),
    metadata: {
      scope: "full_llm_run",
      requests: modelCalls.length,
      ...(modelCalls.some((call) => call.cachedInputTokens !== undefined)
        ? { cachedInputTokens }
        : {}),
      ...(modelCalls.some((call) => call.cacheWriteTokens !== undefined)
        ? { cacheWriteTokens }
        : {}),
      models: Array.from(models),
    },
  };
}

function usageAttributes(usage: UsageSummary) {
  const metadata = usage.metadata;
  return {
    "gen_ai.provider.name": usage.provider,
    "gen_ai.usage.input_tokens": usage.inputTokens,
    "gen_ai.usage.cache_read.input_tokens": metadata?.cachedInputTokens,
    "gen_ai.usage.cache_creation.input_tokens": metadata?.cacheWriteTokens,
    "gen_ai.usage.output_tokens": usage.outputTokens,
    "gen_ai.usage.reasoning.output_tokens": usage.reasoningTokens,
  };
}

/** Builds the normalized trace shape documented for Vitest Evals harnesses. */
export function buildEvalModelCallTrace({
  name,
  operationName,
  modelCalls,
}: {
  name: string;
  operationName: Extract<
    GenAiOperationName,
    "invoke_agent" | "invoke_workflow"
  >;
  modelCalls: EvalModelCall[];
}): SimpleTraceRecord[] | undefined {
  if (modelCalls.length === 0) {
    return undefined;
  }

  const traceId = `peated_eval_${++nextEvalTraceId}`;
  const rootSpanId = `${traceId}:run`;
  const usage = summarizeEvalModelCalls(modelCalls);
  const startedAt = modelCalls[0]?.startedAt;
  const finishedAt = modelCalls[modelCalls.length - 1]?.finishedAt;
  const durationMs = Math.max(
    0,
    new Date(finishedAt ?? 0).getTime() - new Date(startedAt ?? 0).getTime(),
  );
  const requestModels = new Set(modelCalls.map((call) => call.requestModel));
  const responseModels = new Set(modelCalls.map((call) => call.responseModel));

  return [
    {
      id: traceId,
      name,
      startedAt,
      finishedAt,
      durationMs,
      metadata: { source: "peated-openai-capture" },
      spans: [
        {
          id: rootSpanId,
          traceId,
          name: `${operationName} ${name}`,
          kind: operationName === "invoke_agent" ? "agent" : "run",
          startedAt,
          finishedAt,
          durationMs,
          status: "ok",
          attributes: {
            "gen_ai.operation.name": operationName,
            ...(operationName === "invoke_agent"
              ? { "gen_ai.agent.name": name }
              : { "gen_ai.workflow.name": name }),
            ...usageAttributes(usage),
            ...(requestModels.size === 1
              ? { "gen_ai.request.model": modelCalls[0]?.requestModel }
              : {}),
            ...(responseModels.size === 1
              ? { "gen_ai.response.model": modelCalls[0]?.responseModel }
              : {}),
          },
        },
        ...modelCalls.map((call, index) => ({
          id: `${traceId}:model:${index + 1}`,
          traceId,
          parentId: rootSpanId,
          name: `${call.operationName} ${call.requestModel}`,
          kind: "model" as const,
          startedAt: call.startedAt,
          finishedAt: call.finishedAt,
          durationMs: call.durationMs,
          status: "ok" as const,
          attributes: {
            "gen_ai.operation.name": call.operationName,
            "gen_ai.provider.name": call.providerName,
            "gen_ai.request.model": call.requestModel,
            "gen_ai.response.model": call.responseModel,
            "gen_ai.response.id": call.responseId,
            "gen_ai.usage.input_tokens": call.inputTokens,
            "gen_ai.usage.cache_read.input_tokens": call.cachedInputTokens,
            "gen_ai.usage.cache_creation.input_tokens": call.cacheWriteTokens,
            "gen_ai.usage.output_tokens": call.outputTokens,
            "gen_ai.usage.reasoning.output_tokens": call.reasoningTokens,
          },
        })),
      ],
    },
  ];
}
