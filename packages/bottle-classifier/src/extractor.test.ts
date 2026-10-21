import { describe, expect, test, vi } from "vitest";
import {
  createWhiskyLabelExtractor,
  type WhiskyLabelClient,
} from "./extractor";

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
    const client = { responses: { create } } satisfies WhiskyLabelClient;
    const extractor = createWhiskyLabelExtractor({
      client,
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
        text: {
          format: expect.objectContaining({
            type: "json_schema",
            strict: true,
            schema: expect.objectContaining({
              properties: expect.objectContaining({
                result: expect.objectContaining({
                  anyOf: expect.arrayContaining([
                    expect.objectContaining({
                      type: "object",
                      properties: expect.objectContaining({
                        bottling_year: expect.any(Object),
                      }),
                      required: expect.arrayContaining(["bottling_year"]),
                      additionalProperties: false,
                    }),
                  ]),
                }),
                rawLabelText: expect.any(Object),
              }),
              required: expect.arrayContaining(["result", "rawLabelText"]),
              additionalProperties: false,
            }),
          }),
        },
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

  test("keeps the label reading when the release date is incomplete", async () => {
    // A Gordon & MacPhail label printing `Bottled 05.03.2025` and no release
    // year, read as a release month and day.
    const result = {
      brand: "Gordon & MacPhail",
      bottler: "Gordon & MacPhail",
      expression: "Connoisseurs Choice Aultmore",
      series: "Connoisseurs Choice",
      distillery: ["Aultmore"],
      category: "single_malt",
      stated_age: 15,
      abv: 57.3,
      release_year: null,
      release_month: 3,
      release_day: 5,
      vintage_year: 2009,
      bottling_year: 2025,
      cask_strength: true,
      single_cask: true,
      maturation: "First fill bourbon barrel",
      cask_number: "4679",
      outturn: 200,
      edition: null,
    };
    const create = vi.fn().mockResolvedValue({
      id: "resp_123",
      model: "gpt-5.6-luna",
      output_text: JSON.stringify({ result, rawLabelText: "AULTMORE" }),
    });
    const extractor = createWhiskyLabelExtractor({
      client: { responses: { create } },
      model: "gpt-5.6-luna",
    });

    const extraction = await extractor.extractFromImageWithMetadata(
      "data:image/jpeg;base64,dGVzdA==",
    );

    expect(extraction.result).toEqual({
      ...result,
      release_month: null,
      release_day: null,
    });
  });
});
