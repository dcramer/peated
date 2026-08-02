import OpenAI from "openai";
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

const evalOpenAIConfig = resolveOpenAICompatibleConfig(process.env);

export const evalClassifierModel = evalOpenAIConfig.model;
export const evalClassifierReasoningEffort = resolveOpenAIReasoningEffort(
  evalClassifierModel,
  evalOpenAIConfig.reasoningEffort,
);
export const evalImageExtractionModel = evalOpenAIConfig.imageExtractionModel;
export const evalImageExtractionReasoningEffort = resolveOpenAIReasoningEffort(
  evalImageExtractionModel,
  evalOpenAIConfig.imageExtractionReasoningEffort,
);
export const evalJudgeModel = evalOpenAIConfig.evalModel;
export const evalJudgeReasoningEffort = resolveOpenAIReasoningEffort(
  evalJudgeModel,
  evalOpenAIConfig.evalReasoningEffort,
);
export const hasEvalOpenAICredentials = Boolean(evalOpenAIConfig.apiKey);

export function createEvalOpenAIClient() {
  const client = new OpenAI({
    apiKey: evalOpenAIConfig.apiKey,
    baseURL: evalOpenAIConfig.baseURL,
    organization: evalOpenAIConfig.organization,
    project: evalOpenAIConfig.project,
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
      process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 3,
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
  const response = await createEvalOpenAIClient().responses.create({
    model: evalJudgeModel,
    ...(options?.system ? { instructions: options.system } : {}),
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
  });

  return response.output_text;
}
