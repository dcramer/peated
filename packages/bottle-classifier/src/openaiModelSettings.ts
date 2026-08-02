import type { ModelSettings } from "@openai/agents";

export const DEFAULT_OPENAI_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_EVAL_MODEL = "gpt-5-mini";
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

export function parseOpenAIReasoningEffort(
  value: string | undefined,
): OpenAIReasoningEffort | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (
    OPENAI_REASONING_EFFORTS.includes(
      normalized as (typeof OPENAI_REASONING_EFFORTS)[number],
    )
  ) {
    return normalized as OpenAIReasoningEffort;
  }

  throw new Error(
    `OPENAI_REASONING_EFFORT must be one of: ${OPENAI_REASONING_EFFORTS.join(", ")}`,
  );
}

export function getStableOpenAISettings(
  model: string,
  reasoningEffort?: OpenAIReasoningEffort,
): {
  temperature?: number;
  reasoning?: { effort: OpenAIReasoningEffort };
} {
  const modelName = model.toLowerCase().split("/").at(-1) ?? model;
  const resolvedReasoningEffort = resolveOpenAIReasoningEffort(
    model,
    reasoningEffort,
  );
  return {
    ...(modelName.startsWith("gpt-5") ? {} : { temperature: 0 }),
    ...(resolvedReasoningEffort
      ? { reasoning: { effort: resolvedReasoningEffort } }
      : {}),
  };
}

export function resolveOpenAIReasoningEffort(
  model: string,
  reasoningEffort?: OpenAIReasoningEffort,
): OpenAIReasoningEffort | undefined {
  const modelName = model.toLowerCase().split("/").at(-1) ?? model;
  return modelName.startsWith("gpt-5") ? reasoningEffort : undefined;
}
