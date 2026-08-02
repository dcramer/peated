import { describe, expect, test } from "vitest";
import {
  buildOpenAIResponsesRequestAttributes,
  buildOpenAIResponsesResponseAttributes,
} from "./openaiResponsesTelemetry";

describe("OpenAI Responses telemetry", () => {
  test("uses current content-free GenAI request semantics", () => {
    expect(
      buildOpenAIResponsesRequestAttributes({
        baseURL: "https://gateway.example.com:8443/v1",
        conversationId: "photo_identification:123",
        model: "openai/gpt-5.6-luna",
      }),
    ).toEqual({
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openai",
      "gen_ai.request.model": "openai/gpt-5.6-luna",
      "gen_ai.request.stream": false,
      "gen_ai.output.type": "json",
      "gen_ai.conversation.id": "photo_identification:123",
      "openai.api.type": "responses",
      "server.address": "gateway.example.com",
      "server.port": 8443,
      "sentry.op": "gen_ai.chat",
    });
  });

  test("records provider response and billable token breakdowns", () => {
    expect(
      buildOpenAIResponsesResponseAttributes({
        response: {
          id: "resp_123",
          model: "gpt-5.6-luna-2026-07-15",
          serviceTier: "default",
        },
        usage: {
          inputTokens: 6_992,
          cachedInputTokens: 5_888,
          outputTokens: 621,
          reasoningTokens: 448,
        },
      }),
    ).toEqual({
      "gen_ai.response.id": "resp_123",
      "gen_ai.response.model": "gpt-5.6-luna-2026-07-15",
      "openai.response.service_tier": "default",
      "gen_ai.usage.input_tokens": 6_992,
      "gen_ai.usage.cache_read.input_tokens": 5_888,
      "gen_ai.usage.output_tokens": 621,
      "gen_ai.usage.reasoning.output_tokens": 448,
    });
  });
});
