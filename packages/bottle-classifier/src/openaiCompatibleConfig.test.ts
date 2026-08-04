import { describe, expect, expectTypeOf, it } from "vitest";
import { resolveOpenAICompatibleConfig } from "./openaiCompatibleConfig";
import {
  getStableOpenAISettings,
  resolveOpenAIReasoningEffort,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";

describe("resolveOpenAICompatibleConfig", () => {
  it("exposes only the app-supported reasoning efforts to callers", () => {
    expectTypeOf<"high">().toMatchTypeOf<OpenAIReasoningEffort>();
    expectTypeOf<"minimal">().not.toMatchTypeOf<OpenAIReasoningEffort>();
  });

  it("accepts typed environment objects without declared OpenAI keys", () => {
    const env: Readonly<{ NODE_ENV: "test" }> = {
      NODE_ENV: "test",
    };

    expect(resolveOpenAICompatibleConfig(env)).toMatchObject({
      baseURL: "https://api.openai.com/v1",
      provider: "openai",
    });
  });

  it("uses direct OpenAI defaults", () => {
    expect(
      resolveOpenAICompatibleConfig({
        OPENAI_API_KEY: "openai-key",
      }),
    ).toEqual({
      apiKey: "openai-key",
      baseURL: "https://api.openai.com/v1",
      bottleClassifierModel: "gpt-5.6-terra",
      bottleClassifierReasoningEffort: "medium",
      embeddingModel: "text-embedding-3-large",
      evalModel: "gpt-5.6-luna",
      evalReasoningEffort: "medium",
      imageExtractionModel: "gpt-5.6-luna",
      imageExtractionReasoningEffort: "high",
      model: "gpt-5.4",
      organization: undefined,
      project: undefined,
      provider: "openai",
      reasoningEffort: undefined,
    });
  });

  it("uses gateway credentials and provider-qualified defaults", () => {
    const config = resolveOpenAICompatibleConfig({
      AI_GATEWAY_API_KEY: "gateway-key",
      OPENAI_API_KEY: "openai-key",
    });

    expect(config).toEqual({
      apiKey: "gateway-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
      bottleClassifierModel: "openai/gpt-5.6-terra",
      bottleClassifierReasoningEffort: "medium",
      embeddingModel: "openai/text-embedding-3-large",
      evalModel: "openai/gpt-5.6-luna",
      evalReasoningEffort: "medium",
      imageExtractionModel: "openai/gpt-5.6-luna",
      imageExtractionReasoningEffort: "high",
      model: "openai/gpt-5.4",
      organization: undefined,
      project: undefined,
      provider: "vercel-ai-gateway",
      reasoningEffort: undefined,
    });
    expect(getStableOpenAISettings(config.model)).toEqual({});
    expect(
      getStableOpenAISettings(
        config.bottleClassifierModel,
        config.bottleClassifierReasoningEffort,
      ),
    ).toEqual({ reasoning: { effort: "medium" } });
    expect(
      getStableOpenAISettings(config.evalModel, config.evalReasoningEffort),
    ).toEqual({ reasoning: { effort: "medium" } });
  });

  it("normalizes gateway overrides and ignores direct-provider settings", () => {
    expect(
      resolveOpenAICompatibleConfig({
        AI_GATEWAY_API_KEY: "gateway-key",
        BOTTLE_CLASSIFIER_MODEL: "gpt-5.6-luna",
        BOTTLE_CLASSIFIER_REASONING_EFFORT: "low",
        OPENAI_EMBEDDING_MODEL: "openai/text-embedding-3-small",
        OPENAI_EVAL_MODEL: "gpt-5-mini",
        OPENAI_EVAL_REASONING_EFFORT: "xhigh",
        OPENAI_HOST: "https://example.com/v1",
        OPENAI_IMAGE_EXTRACTION_MODEL: "gpt-5.6-luna",
        OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT: "xhigh",
        OPENAI_MODEL: "gpt-5.4",
        OPENAI_ORGANIZATION: "organization",
        OPENAI_PROJECT: "project",
      }),
    ).toMatchObject({
      baseURL: "https://ai-gateway.vercel.sh/v1",
      bottleClassifierModel: "openai/gpt-5.6-luna",
      bottleClassifierReasoningEffort: "low",
      embeddingModel: "openai/text-embedding-3-small",
      evalModel: "openai/gpt-5-mini",
      evalReasoningEffort: "xhigh",
      imageExtractionModel: "openai/gpt-5.6-luna",
      imageExtractionReasoningEffort: "xhigh",
      model: "openai/gpt-5.4",
      organization: undefined,
      project: undefined,
    });
  });

  it("falls back to direct OpenAI when the gateway key is blank", () => {
    expect(
      resolveOpenAICompatibleConfig({
        AI_GATEWAY_API_KEY: "  ",
        OPENAI_API_KEY: "openai-key",
        OPENAI_HOST: "https://example.com/v1",
        OPENAI_MODEL: "custom-model",
      }),
    ).toMatchObject({
      apiKey: "openai-key",
      baseURL: "https://example.com/v1",
      model: "custom-model",
      provider: "openai",
    });
  });

  it("applies an explicit effort to GPT-5 models", () => {
    const config = resolveOpenAICompatibleConfig({
      OPENAI_MODEL: "gpt-5.6-luna",
      OPENAI_REASONING_EFFORT: " HIGH ",
    });

    expect(config.reasoningEffort).toBe("high");
    expect(
      getStableOpenAISettings(config.model, config.reasoningEffort),
    ).toEqual({ reasoning: { effort: "high" } });
    expect(
      resolveOpenAIReasoningEffort(config.model, config.reasoningEffort),
    ).toBe("high");
  });

  it("applies an explicit effort to the eval judge independently", () => {
    const config = resolveOpenAICompatibleConfig({
      OPENAI_EVAL_MODEL: "gpt-5.6-luna",
      OPENAI_EVAL_REASONING_EFFORT: "high",
      OPENAI_REASONING_EFFORT: "low",
    });

    expect(config.evalReasoningEffort).toBe("high");
    expect(
      getStableOpenAISettings(config.evalModel, config.evalReasoningEffort),
    ).toEqual({ reasoning: { effort: "high" } });
    expect(config.reasoningEffort).toBe("low");
  });

  it("does not send reasoning settings to custom non-GPT-5 models", () => {
    const config = resolveOpenAICompatibleConfig({
      OPENAI_MODEL: "custom-model",
      OPENAI_REASONING_EFFORT: "high",
    });

    expect(
      getStableOpenAISettings(config.model, config.reasoningEffort),
    ).toEqual({ temperature: 0 });
    expect(
      resolveOpenAIReasoningEffort(config.model, config.reasoningEffort),
    ).toBeUndefined();
  });

  it.each(["minimal", "max"])(
    "rejects unsupported reasoning effort %s",
    (reasoningEffort) => {
      expect(() =>
        resolveOpenAICompatibleConfig({
          OPENAI_REASONING_EFFORT: reasoningEffort,
        }),
      ).toThrow(
        "OPENAI_REASONING_EFFORT must be one of: none, low, medium, high, xhigh",
      );
    },
  );

  it("identifies an invalid eval judge effort", () => {
    expect(() =>
      resolveOpenAICompatibleConfig({
        OPENAI_EVAL_REASONING_EFFORT: "maximum",
      }),
    ).toThrow(
      "OPENAI_EVAL_REASONING_EFFORT must be one of: none, low, medium, high, xhigh",
    );
  });
});
