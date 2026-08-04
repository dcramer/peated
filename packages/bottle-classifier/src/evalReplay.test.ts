import { describe, expect, test } from "vitest";
import {
  assertSuccessfulWebSearchReplay,
  sanitizeWebSearchRecording,
} from "./evalReplay";

describe("web-search eval replay integrity", () => {
  test("accepts successful evidence recordings", () => {
    const recording = {
      writtenAt: "2026-08-01T00:00:00.000Z",
      toolName: "firecrawl_web_search",
      input: { queries: ["Talisker 2001 Distillers Edition"] },
      output: {
        evidence: [
          {
            provider: "firecrawl",
            query: "Talisker 2001 Distillers Edition",
            summary: "The bottle was distilled in 2001 and bottled in 2012.",
            results: [],
          },
        ],
        errors: [],
      },
    };

    expect(sanitizeWebSearchRecording(recording)).toBe(recording);
  });

  test.each([
    "Firecrawl web search failed: Connection error.",
    "Web evidence budget exhausted after 3 units",
  ])("rejects recorded search errors: %s", (error) => {
    expect(() => assertSuccessfulWebSearchReplay({ error })).toThrow(
      "Web-search replay recordings must contain evidence, not an error",
    );
  });

  test("rejects a failed query in a batched search recording", () => {
    expect(() =>
      assertSuccessfulWebSearchReplay({
        evidence: [],
        errors: [
          {
            query: "Laphroaig Elements L2.0 59.6% cask strength",
            error: "Firecrawl search failed (502)",
          },
        ],
      }),
    ).toThrow(
      "Web-search replay recordings must contain evidence, not an error: Firecrawl search failed (502)",
    );
  });

  test("rejects thrown provider errors before recording them", () => {
    expect(() =>
      sanitizeWebSearchRecording({
        writtenAt: "2026-08-01T00:00:00.000Z",
        toolName: "firecrawl_web_search",
        input: { queries: ["Talisker 2001 Distillers Edition"] },
        error: { message: "Connection error.", type: "FirecrawlError" },
      }),
    ).toThrow(
      "Web-search replay recordings must contain evidence, not an error",
    );
  });
});
