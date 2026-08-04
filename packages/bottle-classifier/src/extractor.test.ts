import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";
import { createWhiskyLabelExtractor } from "./extractor";

describe("createWhiskyLabelExtractor", () => {
  test("uses image-specific model settings and returns provider usage", async () => {
    const onImageExtractionMetadata = vi.fn();
    const create = vi.fn().mockResolvedValue({
      id: "resp_123",
      model: "gpt-5.6-luna-2026-07-15",
      output_text: JSON.stringify({
        result: null,
        rawLabelText: "Pokeno CASK NO 71 BOTTLE NO 100",
      }),
      service_tier: "default",
      usage: {
        input_tokens: 1_000,
        input_tokens_details: { cached_tokens: 100 },
        output_tokens: 200,
        output_tokens_details: { reasoning_tokens: 150 },
        total_tokens: 1_200,
      },
    });
    const extractor = createWhiskyLabelExtractor({
      client: { responses: { create } } as unknown as OpenAI,
      model: "gpt-5.4",
      imageModel: "gpt-5.6-luna",
      imageReasoningEffort: "high",
      onImageExtractionMetadata,
    });

    const extraction = await extractor.extractFromImageWithMetadata(
      "data:image/jpeg;base64,dGVzdA==",
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        reasoning: { effort: "high" },
      }),
    );
    expect(extraction).toMatchObject({
      result: null,
      rawLabelText: "Pokeno CASK NO 71 BOTTLE NO 100",
      response: {
        id: "resp_123",
        model: "gpt-5.6-luna-2026-07-15",
        serviceTier: "default",
      },
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 200,
        reasoningTokens: 150,
        totalTokens: 1_200,
      },
    });
    expect(onImageExtractionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        response: extraction.response,
        usage: extraction.usage,
      }),
    );
    expect(extraction.durationMs).toBeGreaterThanOrEqual(0);
  });
});
