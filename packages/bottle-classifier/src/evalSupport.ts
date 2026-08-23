import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type {
  BottleClassifierDataSource,
  CreateBottleClassifierOptions,
} from "./classifierRuntime";
import {
  getActiveEvalModelCallStore,
  recordEvalOpenAIResponse,
} from "./evalTelemetry";
import { resolveOpenAICompatibleConfig } from "./openaiCompatibleConfig";
import {
  getStableOpenAISettings,
  resolveOpenAIReasoningEffort,
} from "./openaiModelSettings";

const evalGatewayConfig = resolveOpenAICompatibleConfig(process.env);

export const evalClassifierModel = evalGatewayConfig.bottleClassifierModel;
export const evalClassifierReasoningEffort = resolveOpenAIReasoningEffort(
  evalClassifierModel,
  evalGatewayConfig.bottleClassifierReasoningEffort,
);
export const evalImageExtractionModel = evalGatewayConfig.imageExtractionModel;
export const evalImageExtractionReasoningEffort = resolveOpenAIReasoningEffort(
  evalImageExtractionModel,
  evalGatewayConfig.imageExtractionReasoningEffort,
);
export const evalJudgeModel = evalGatewayConfig.evalModel;
export const evalJudgeReasoningEffort = resolveOpenAIReasoningEffort(
  evalJudgeModel,
  evalGatewayConfig.evalReasoningEffort,
);
export const hasEvalAIGatewayCredentials = Boolean(evalGatewayConfig.apiKey);

export function createEvalOpenAIClient() {
  const client = new OpenAI({
    apiKey: evalGatewayConfig.apiKey,
    baseURL: evalGatewayConfig.baseURL,
  });
  const originalCreate = client.responses.create.bind(client.responses);

  const instrumentedCreate = (...args: Parameters<typeof originalCreate>) => {
    const request = args[0];
    const store = getActiveEvalModelCallStore();
    const startedAt = new Date();
    const requestPromise = originalCreate(...args);

    if (store && request?.stream !== true) {
      void requestPromise.then(
        (response) => {
          recordEvalOpenAIResponse({
            request,
            response,
            startedAt,
            store,
          });
        },
        () => undefined,
      );
    }

    return requestPromise;
  };

  Object.defineProperty(client.responses, "create", {
    configurable: true,
    // SAFETY: The wrapper accepts and forwards the exact original parameters and return value.
    value: instrumentedCreate as typeof client.responses.create,
  });

  return client;
}

export function createEvalClassifierOptions(
  dataSource: BottleClassifierDataSource,
): CreateBottleClassifierOptions {
  return {
    client: createEvalOpenAIClient(),
    model: evalClassifierModel,
    reasoningEffort: evalClassifierReasoningEffort,
    imageExtractionModel: evalImageExtractionModel,
    imageExtractionReasoningEffort: evalImageExtractionReasoningEffort,
    maxSearchQueries: Number(
      process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 2,
    ),
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? null,
    firecrawlApiUrl: process.env.FIRECRAWL_API_URL ?? null,
    dataSource,
  };
}

export function getEvalJudgeModelSettings() {
  return getStableOpenAISettings(evalJudgeModel, evalJudgeReasoningEffort);
}

export async function promptEvalJudgeModel(
  input: string,
  options?: { system?: string },
) {
  const request: ResponseCreateParamsNonStreaming = {
    model: evalJudgeModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input,
          },
        ],
      },
    ],
    ...getEvalJudgeModelSettings(),
  };
  if (options?.system) request.instructions = options.system;
  const response = await createEvalOpenAIClient().responses.create(request);

  return response.output_text;
}
