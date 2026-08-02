import { describe, expect, test } from "vitest";
import {
  assertSuccessfulWebSearchReplay,
  sanitizeWebSearchRecording,
} from "./evalReplay";

describe("web-search eval replay integrity", () => {
  test("accepts successful evidence recordings", () => {
    const recording = {
      writtenAt: "2026-08-01T00:00:00.000Z",
      toolName: "openai_web_search",
      input: { query: "Talisker 2001 Distillers Edition" },
      output: {
        provider: "openai",
        query: "Talisker 2001 Distillers Edition",
        summary: "The bottle was distilled in 2001 and bottled in 2012.",
        results: [],
      },
    };

    expect(sanitizeWebSearchRecording(recording)).toBe(recording);
  });

  test.each([
    "OpenAI web search failed: Connection error.",
    "Search budget exhausted after 3 queries",
  ])("rejects recorded search errors: %s", (error) => {
    expect(() => assertSuccessfulWebSearchReplay({ error })).toThrow(
      "Web-search replay recordings must contain evidence, not an error",
    );
  });

  test("rejects thrown provider errors before recording them", () => {
    expect(() =>
      sanitizeWebSearchRecording({
        writtenAt: "2026-08-01T00:00:00.000Z",
        toolName: "openai_web_search",
        input: { query: "Talisker 2001 Distillers Edition" },
        error: { message: "Connection error.", type: "OpenAIError" },
      }),
    ).toThrow(
      "Web-search replay recordings must contain evidence, not an error",
    );
  });
});
