import { describe, expect, test } from "vitest";
import {
  normalizeGenAiSpan,
  normalizeStreamedGenAiSpan,
} from "./genAiTelemetry";

describe("normalizeGenAiSpan", () => {
  test("adds the current provider attribute to Sentry OpenAI spans", () => {
    expect(
      normalizeGenAiSpan({
        op: "gen_ai.chat",
        data: {
          "gen_ai.system": "openai",
          "gen_ai.operation.name": "chat",
          "gen_ai.request.model": "gpt-5.6-terra",
        },
      }),
    ).toEqual({
      op: "gen_ai.chat",
      data: {
        "gen_ai.system": "openai",
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "gpt-5.6-terra",
      },
    });
  });

  test("does not assign a provider to unrelated spans", () => {
    const span = { op: "http.client", data: {} };
    expect(normalizeGenAiSpan(span)).toBe(span);
  });

  test("normalizes the streamed span shape used by the server", () => {
    const span = {
      trace_id: "trace",
      span_id: "span",
      name: "chat gpt-5.6-terra",
      start_timestamp: 1,
      end_timestamp: 2,
      status: "ok" as const,
      is_segment: false,
      attributes: {
        "sentry.op": "gen_ai.chat",
        "gen_ai.system": "openai",
      },
    };

    expect(normalizeStreamedGenAiSpan(span).attributes).toMatchObject({
      "gen_ai.provider.name": "openai",
    });
  });
});
