import { AsyncLocalStorage } from "node:async_hooks";
import type {
  GenAiOperationName,
  JsonValue,
  SimpleTraceRecord,
  UsageSummary,
} from "vitest-evals/harness";
import { z } from "zod";

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

interface TraceAttributes {
  [key: string]: JsonValue | undefined;
}

const evalModelCallStorage = new AsyncLocalStorage<EvalModelCallStore>();
let nextEvalTraceId = 0;

const UsageDetailsSchema = z.record(z.string(), z.number());
const EvalUsageSchema = z
  .object({
    input_tokens: z.number().optional(),
    inputTokens: z.number().optional(),
    output_tokens: z.number().optional(),
    outputTokens: z.number().optional(),
    total_tokens: z.number().optional(),
    totalTokens: z.number().optional(),
    input_tokens_details: UsageDetailsSchema.optional(),
    inputTokensDetails: UsageDetailsSchema.optional(),
    output_tokens_details: UsageDetailsSchema.optional(),
    outputTokensDetails: UsageDetailsSchema.optional(),
  })
  .passthrough();
const EvalRequestSchema = z.object({ model: z.string().min(1) }).passthrough();
const EvalResponseSchema = z
  .object({
    id: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    usage: EvalUsageSchema.optional(),
  })
  .passthrough();
type EvalUsage = z.infer<typeof EvalUsageSchema>;
type UsageProperty =
  | "input_tokens"
  | "inputTokens"
  | "output_tokens"
  | "outputTokens"
  | "total_tokens"
  | "totalTokens";
type UsageDetailsProperty =
  | "input_tokens_details"
  | "inputTokensDetails"
  | "output_tokens_details"
  | "outputTokensDetails";

function finiteNonnegativeNumber(
  value: number | undefined,
): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function usageNumber(
  usage: EvalUsage | undefined,
  ...properties: UsageProperty[]
): number {
  for (const property of properties) {
    const measured = finiteNonnegativeNumber(usage?.[property]);
    if (measured !== undefined) {
      return measured;
    }
  }

  return 0;
}

function usageDetailNumber(
  usage: EvalUsage | undefined,
  detailProperties: UsageDetailsProperty[],
  valueProperties: string[],
): number | undefined {
  for (const detailProperty of detailProperties) {
    const details = usage?.[detailProperty];
    for (const valueProperty of valueProperties) {
      const measured = finiteNonnegativeNumber(details?.[valueProperty]);
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
  const parsedRequest = EvalRequestSchema.safeParse(request);
  if (!parsedRequest.success) return null;
  const parsedResponse = EvalResponseSchema.safeParse(response);
  const requestModel = parsedRequest.data.model;
  const responseModel = parsedResponse.success
    ? parsedResponse.data.model
    : undefined;
  const usage = parsedResponse.success ? parsedResponse.data.usage : undefined;
  const inputTokens = usageNumber(usage, "input_tokens", "inputTokens");
  const outputTokens = usageNumber(usage, "output_tokens", "outputTokens");
  const totalTokens = usageNumber(usage, "total_tokens", "totalTokens");
  const responseId = parsedResponse.success
    ? parsedResponse.data.id
    : undefined;
  const cachedInputTokens = usageDetailNumber(
    usage,
    ["input_tokens_details", "inputTokensDetails"],
    ["cached_tokens", "cachedTokens"],
  );
  const cacheWriteTokens = usageDetailNumber(
    usage,
    ["input_tokens_details", "inputTokensDetails"],
    ["cache_write_tokens", "cacheWriteTokens"],
  );
  const reasoningTokens = usageDetailNumber(
    usage,
    ["output_tokens_details", "outputTokensDetails"],
    ["reasoning_tokens", "reasoningTokens"],
  );

  const modelCall: EvalModelCall = {
    operationName: "chat",
    providerName: "openai",
    requestModel,
    responseModel: responseModel ?? requestModel,
    inputTokens,
    outputTokens,
    totalTokens: totalTokens || inputTokens + outputTokens,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
  };
  if (responseId) modelCall.responseId = responseId;
  if (cachedInputTokens !== undefined) {
    modelCall.cachedInputTokens = cachedInputTokens;
  }
  if (cacheWriteTokens !== undefined) {
    modelCall.cacheWriteTokens = cacheWriteTokens;
  }
  if (reasoningTokens !== undefined) {
    modelCall.reasoningTokens = reasoningTokens;
  }
  return modelCall;
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

  const metadata: NonNullable<UsageSummary["metadata"]> = {
    scope: "full_llm_run",
    requests: modelCalls.length,
    models: Array.from(models),
  };
  if (modelCalls.some((call) => call.cachedInputTokens !== undefined)) {
    metadata.cachedInputTokens = cachedInputTokens;
  }
  if (modelCalls.some((call) => call.cacheWriteTokens !== undefined)) {
    metadata.cacheWriteTokens = cacheWriteTokens;
  }

  const summary: UsageSummary = {
    provider: "openai",
    inputTokens: modelCalls.reduce(
      (total, call) => total + call.inputTokens,
      0,
    ),
    outputTokens: modelCalls.reduce(
      (total, call) => total + call.outputTokens,
      0,
    ),
    totalTokens: modelCalls.reduce(
      (total, call) => total + call.totalTokens,
      0,
    ),
    metadata,
  };
  if (models.size === 1) summary.model = modelCalls[0]?.responseModel;
  if (modelCalls.some((call) => call.reasoningTokens !== undefined)) {
    summary.reasoningTokens = reasoningTokens;
  }
  return summary;
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
  const rootAttributes: TraceAttributes = {
    "gen_ai.operation.name": operationName,
    ...usageAttributes(usage),
  };
  if (operationName === "invoke_agent") {
    rootAttributes["gen_ai.agent.name"] = name;
  } else {
    rootAttributes["gen_ai.workflow.name"] = name;
  }
  if (requestModels.size === 1) {
    rootAttributes["gen_ai.request.model"] = modelCalls[0]?.requestModel;
  }
  if (responseModels.size === 1) {
    rootAttributes["gen_ai.response.model"] = modelCalls[0]?.responseModel;
  }

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
          attributes: rootAttributes,
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
