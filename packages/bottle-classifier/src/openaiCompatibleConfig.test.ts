import { describe, expect, it } from "vitest";
import { resolveOpenAICompatibleConfig } from "./openaiCompatibleConfig";
import { getStableOpenAISettings } from "./openaiModelSettings";

describe("resolveOpenAICompatibleConfig", () => {
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
      embeddingModel: "text-embedding-3-large",
      evalModel: "gpt-5-mini",
      model: "gpt-5.4",
      organization: undefined,
      project: undefined,
      provider: "openai",
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
      embeddingModel: "openai/text-embedding-3-large",
      evalModel: "openai/gpt-5-mini",
      model: "openai/gpt-5.4",
      organization: undefined,
      project: undefined,
      provider: "vercel-ai-gateway",
    });
    expect(getStableOpenAISettings(config.model)).toEqual({});
    expect(getStableOpenAISettings(config.evalModel)).toEqual({});
  });

  it("normalizes gateway overrides and ignores direct-provider settings", () => {
    expect(
      resolveOpenAICompatibleConfig({
        AI_GATEWAY_API_KEY: "gateway-key",
        OPENAI_EMBEDDING_MODEL: "openai/text-embedding-3-small",
        OPENAI_EVAL_MODEL: "gpt-5-mini",
        OPENAI_HOST: "https://example.com/v1",
        OPENAI_MODEL: "gpt-5.4",
        OPENAI_ORGANIZATION: "organization",
        OPENAI_PROJECT: "project",
      }),
    ).toMatchObject({
      baseURL: "https://ai-gateway.vercel.sh/v1",
      embeddingModel: "openai/text-embedding-3-small",
      evalModel: "openai/gpt-5-mini",
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
});
