export const DEFAULT_OPENAI_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_EVAL_MODEL = "gpt-5-mini";

export function getStableOpenAISettings(model: string): {
  temperature?: number;
} {
  const modelName = model.toLowerCase().split("/").at(-1) ?? model;
  return modelName.startsWith("gpt-5") ? {} : { temperature: 0 };
}
