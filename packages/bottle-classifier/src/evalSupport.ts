import OpenAI from "openai";
import type {
  BottleClassifierAdapters,
  CreateBottleClassifierOptions,
} from "./classifierRuntime";
import {
  DEFAULT_OPENAI_EVAL_MODEL,
  DEFAULT_OPENAI_MODEL,
  getStableOpenAISettings,
} from "./openaiModelSettings";

export const evalClassifierModel =
  process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
export const evalJudgeModel =
  process.env.OPENAI_EVAL_MODEL ?? DEFAULT_OPENAI_EVAL_MODEL;

export function createEvalOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_HOST,
    organization: process.env.OPENAI_ORGANIZATION,
    project: process.env.OPENAI_PROJECT,
  });
}

export function createEvalClassifierOptions(
  adapters: BottleClassifierAdapters,
): CreateBottleClassifierOptions {
  return {
    client: createEvalOpenAIClient(),
    model: evalClassifierModel,
    maxSearchQueries: Number(
      process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 3,
    ),
    braveApiKey: process.env.BRAVE_API_KEY ?? null,
    adapters,
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
