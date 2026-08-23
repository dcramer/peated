import type { Span } from "@sentry/core";
import * as Sentry from "@sentry/core";
import { describe, expect, test, vi } from "vitest";
import {
  buildAgentSpanContext,
  buildToolSpanContext,
  type ClassifierSpanContext,
  type ClassifierSpanStarter,
  startAgentSpan,
  startToolSpan,
} from "./observability";

function captureSpans(span: Span) {
  const contexts: ClassifierSpanContext[] = [];
  const startSpan: ClassifierSpanStarter = async (context, callback) => {
    contexts.push(context);
    return await callback(span);
  };
  return { contexts, startSpan };
}

describe("observability span contexts", () => {
  test("builds agent invocation span metadata with the shared conversation id", () => {
    expect(
      buildAgentSpanContext({
        name: "Bottle Classifier",
        conversationId: "photo_identification:pending-1",
        attributes: {
          "bottle_classifier.reference_id": "pending-1",
        },
      }),
    ).toMatchObject({
      op: "gen_ai.invoke_agent",
      name: "invoke_agent Bottle Classifier",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.provider.name": "openai",
        "gen_ai.agent.name": "Bottle Classifier",
        "gen_ai.conversation.id": "photo_identification:pending-1",
        "bottle_classifier.reference_id": "pending-1",
      },
    });
  });

  test("builds tool execution span metadata with compact JSON arguments", () => {
    const context = buildToolSpanContext({
      name: "search_bottles",
      description: "Search local bottles.",
      args: {
        query: "Ardbeg Uigeadail",
      },
    });

    expect(context).toMatchObject({
      op: "gen_ai.execute_tool",
      name: "execute_tool search_bottles",
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": "search_bottles",
        "gen_ai.tool.description": "Search local bottles.",
        "gen_ai.tool.call.arguments": JSON.stringify({
          query: "Ardbeg Uigeadail",
        }),
      },
    });
  });

  test("wraps agent runs in a Sentry agent invocation span", async () => {
    const capture = captureSpans(
      Sentry.startInactiveSpan({ name: "test agent span" }),
    );
    await expect(
      startAgentSpan({
        name: "Bottle Classifier",
        conversationId: "bottle_reference:123",
        attributes: {
          "bottle_classifier.reference_id": "123",
        },
        callback: async () => "done",
        startSpan: capture.startSpan,
      }),
    ).resolves.toBe("done");

    expect(capture.contexts).toEqual([
      expect.objectContaining({
        op: "gen_ai.invoke_agent",
        name: "invoke_agent Bottle Classifier",
        attributes: expect.objectContaining({
          "gen_ai.conversation.id": "bottle_reference:123",
          "bottle_classifier.reference_id": "123",
        }),
      }),
    ]);
  });

  test("records aggregate agent token usage on the invocation span", async () => {
    const span = Sentry.startInactiveSpan({ name: "test agent span" });
    const setAttribute = vi.spyOn(span, "setAttribute");
    const capture = captureSpans(span);

    await startAgentSpan({
      name: "Bottle Classifier",
      conversationId: "bottle_reference:usage",
      callback: async () => ({
        modelMetadata: {
          usage: {
            inputTokens: 100,
            cachedInputTokens: 40,
            cacheWriteTokens: 5,
            outputTokens: 20,
            reasoningTokens: 7,
          },
        },
      }),
      startSpan: capture.startSpan,
    });

    expect(setAttribute).toHaveBeenCalledWith("gen_ai.usage.input_tokens", 100);
    expect(setAttribute).toHaveBeenCalledWith(
      "gen_ai.usage.cache_read.input_tokens",
      40,
    );
    expect(setAttribute).toHaveBeenCalledWith("gen_ai.usage.output_tokens", 20);
    expect(setAttribute).toHaveBeenCalledWith(
      "gen_ai.usage.reasoning.output_tokens",
      7,
    );
  });

  test("records tool results on the Sentry tool span", async () => {
    const span = Sentry.startInactiveSpan({ name: "test tool span" });
    const setAttribute = vi.spyOn(span, "setAttribute");
    const capture = captureSpans(span);

    await expect(
      startToolSpan({
        name: "search_bottles",
        description: "Search local bottles.",
        args: {
          query: "Ardbeg",
        },
        callback: async () => ({
          results: [{ bottleId: 1 }],
        }),
        startSpan: capture.startSpan,
      }),
    ).resolves.toEqual({
      results: [{ bottleId: 1 }],
    });

    expect(setAttribute).toHaveBeenCalledWith(
      "gen_ai.tool.call.result",
      JSON.stringify({
        results: [{ bottleId: 1 }],
      }),
    );
  });
});
