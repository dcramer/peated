export const DEFAULT_OPENAI_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_EVAL_MODEL = "gpt-5-mini";

export function getDeterministicOpenAISettings(model: string): {
  temperature?: number;
} {
  return model.toLowerCase().startsWith("gpt-5") ? {} : { temperature: 0 };
}
