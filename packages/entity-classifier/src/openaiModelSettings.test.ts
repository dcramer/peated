import { describe, expect, test } from "vitest";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";

describe("getDeterministicOpenAISettings", () => {
  test.each(["gpt-5.4", "openai/gpt-5.4", "openai/gpt-6-luna"])(
    "sends no temperature to reasoning model %s",
    (model) => {
      expect(getDeterministicOpenAISettings(model)).toEqual({});
    },
  );

  test.each(["gpt-4.1", "anthropic/claude-haiku-5.5"])(
    "sends a fixed temperature to %s",
    (model) => {
      expect(getDeterministicOpenAISettings(model)).toEqual({ temperature: 0 });
    },
  );
});
