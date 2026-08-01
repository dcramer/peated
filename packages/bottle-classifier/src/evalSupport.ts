import OpenAI from "openai";
import type {
  BottleClassifierDataSource,
  CreateBottleClassifierOptions,
} from "./classifierRuntime";
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
export const evalJudgeModel = evalOpenAIConfig.evalModel;
export const hasEvalOpenAICredentials = Boolean(evalOpenAIConfig.apiKey);

export function createEvalOpenAIClient() {
  return new OpenAI({
    apiKey: evalOpenAIConfig.apiKey,
    baseURL: evalOpenAIConfig.baseURL,
    organization: evalOpenAIConfig.organization,
    project: evalOpenAIConfig.project,
  });
}

export function createEvalClassifierOptions(
  dataSource: BottleClassifierDataSource,
): CreateBottleClassifierOptions {
  return {
    client: createEvalOpenAIClient(),
    model: evalClassifierModel,
    reasoningEffort: evalClassifierReasoningEffort,
    maxSearchQueries: Number(
      process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 3,
    ),
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? null,
    firecrawlApiUrl: process.env.FIRECRAWL_API_URL ?? null,
    dataSource,
  };
}

export function getEvalJudgeModelSettings() {
  return getStableOpenAISettings(evalJudgeModel);
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
