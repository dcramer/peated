import type { ModelSettings } from "@openai/agents";
import { z } from "zod";

export const DEFAULT_BOTTLE_CLASSIFIER_MODEL = "gpt-5.6-terra";
export const DEFAULT_BOTTLE_CLASSIFIER_REASONING_EFFORT = "medium";
export const DEFAULT_OPENAI_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_EVAL_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_EVAL_REASONING_EFFORT = "medium";
export const DEFAULT_OPENAI_IMAGE_EXTRACTION_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT = "high";

type OpenAISdkReasoningEffort = NonNullable<
  NonNullable<ModelSettings["reasoning"]>["effort"]
>;

export const OPENAI_REASONING_EFFORTS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
] as const satisfies readonly OpenAISdkReasoningEffort[];

export type OpenAIReasoningEffort = (typeof OPENAI_REASONING_EFFORTS)[number];
const OpenAIReasoningEffortSchema = z.enum(OPENAI_REASONING_EFFORTS);

export function parseOpenAIReasoningEffort(
  value: string | undefined,
  settingName = "OPENAI_REASONING_EFFORT",
): OpenAIReasoningEffort | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const effort = OpenAIReasoningEffortSchema.safeParse(normalized);
  if (effort.success) return effort.data;

  throw new Error(
    `${settingName} must be one of: ${OPENAI_REASONING_EFFORTS.join(", ")}`,
  );
}

export interface StableOpenAISettings {
  temperature?: number;
  reasoning?: { effort: OpenAIReasoningEffort };
}

export function getStableOpenAISettings(
  model: string,
  reasoningEffort?: OpenAIReasoningEffort,
): StableOpenAISettings {
  const modelName = model.toLowerCase().split("/").at(-1) ?? model;
  const resolvedReasoningEffort = resolveOpenAIReasoningEffort(
    model,
    reasoningEffort,
  );
  const settings: StableOpenAISettings = {};
  if (!modelName.startsWith("gpt-5")) {
    settings.temperature = 0;
  }
  if (resolvedReasoningEffort) {
    settings.reasoning = { effort: resolvedReasoningEffort };
  }
  return settings;
}

export function resolveOpenAIReasoningEffort(
  model: string,
  reasoningEffort?: OpenAIReasoningEffort,
): OpenAIReasoningEffort | undefined {
  const modelName = model.toLowerCase().split("/").at(-1) ?? model;
  return modelName.startsWith("gpt-5") ? reasoningEffort : undefined;
}
