import { describe, expect, test, vi } from "vitest";
import { createWhiskyLabelExtractor } from "./extractor";
import { createTestLanguageModel } from "./testLanguageModel";

const IMAGE = "data:image/jpeg;base64,dGVzdA==";

describe("createWhiskyLabelExtractor", () => {
  test("reads an image with the image model and settings and returns usage", async () => {
    const { model } = createTestLanguageModel({
      result: null,
      rawLabelText: "Pokeno CASK NO 71 BOTTLE NO 100",
    });
    const languageModel = vi.fn(() => model);
    const onImageExtractionMetadata = vi.fn();
    const extractor = createWhiskyLabelExtractor({
      languageModel,
      model: "gpt-5.4",
      imageModel: "gpt-5.6-luna",
      imageReasoningEffort: "high",
      onImageExtractionMetadata,
    });

    const extraction = await extractor.extractFromImageWithMetadata(IMAGE);

    expect(languageModel).toHaveBeenCalledWith("gpt-5.6-luna");
    const call = model.doGenerateCalls[0]!;
    expect(call.reasoning).toBe("high");
    // Every label field is required, so the model cannot leave one out.
    expect(call.responseFormat).toMatchObject({
      type: "json",
      schema: {
        required: ["result", "rawLabelText"],
        properties: {
          result: {
            anyOf: expect.arrayContaining([
              expect.objectContaining({
                required: expect.arrayContaining(["bottling_year"]),
              }),
            ]),
          },
        },
      },
    });
    expect(call.prompt.at(-1)).toMatchObject({
      role: "user",
      content: [
        {
          type: "file",
          providerOptions: { openai: { imageDetail: "high" } },
        },
      ],
    });
    expect(extraction).toMatchObject({
      result: null,
      rawLabelText: "Pokeno CASK NO 71 BOTTLE NO 100",
      response: { id: "resp_123", model: "test-model" },
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

  test("passes the caller's stop signal to the model call", async () => {
    const { languageModel, model } = createTestLanguageModel({
      result: null,
      rawLabelText: null,
    });
    const extractor = createWhiskyLabelExtractor({
      languageModel,
      model: "gpt-5.6-luna",
    });
    const controller = new AbortController();
    controller.abort();

    await extractor.extractFromImageWithMetadata(IMAGE, {
      signal: controller.signal,
    });

    expect(model.doGenerateCalls[0]?.abortSignal?.aborted).toBe(true);
  });

  test("does not retry when the caller sets no retries", async () => {
    const { languageModel, generate } = createTestLanguageModel();
    generate.mockRejectedValue(
      Object.assign(new Error("Service unavailable"), { isRetryable: true }),
    );
    const extractor = createWhiskyLabelExtractor({
      languageModel,
      model: "gpt-5.6-luna",
      limits: { timeoutMs: 45_000, maxRetries: 0 },
    });

    await expect(extractor.extractFromImageWithMetadata(IMAGE)).rejects.toThrow(
      "Service unavailable",
    );
    expect(generate).toHaveBeenCalledTimes(1);
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
    const { languageModel } = createTestLanguageModel({
      result,
      rawLabelText: "AULTMORE",
    });
    const extractor = createWhiskyLabelExtractor({
      languageModel,
      model: "gpt-5.6-luna",
    });

    const extraction = await extractor.extractFromImageWithMetadata(IMAGE);

    expect(extraction.result).toEqual({
      ...result,
      release_month: null,
      release_day: null,
    });
  });
});
