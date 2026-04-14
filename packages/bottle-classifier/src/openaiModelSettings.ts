export function getDeterministicOpenAISettings(model: string): {
  temperature?: number;
} {
  return model.toLowerCase().startsWith("gpt-5") ? {} : { temperature: 0 };
}
