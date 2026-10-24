/**
 * GPT-5 and GPT-6 models ignore temperature. Gateway model names may carry a
 * provider prefix, such as `openai/gpt-5.4`. Matches the rule in
 * @peated/bottle-classifier's openaiModelSettings.
 */
export function getDeterministicOpenAISettings(model: string): {
  temperature?: number;
} {
  const modelName = model.toLowerCase().split("/").at(-1) ?? model;
  return modelName.startsWith("gpt-5") || modelName.startsWith("gpt-6")
    ? {}
    : { temperature: 0 };
}
