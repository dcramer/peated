import type { Span } from "@sentry/core";
import * as Sentry from "@sentry/core";
import { describe, expect, test } from "vitest";
import {
  buildClassifierRunSpanContext,
  type ClassifierSpanContext,
  type ClassifierSpanStarter,
  startClassifierRunSpan,
} from "./observability";

function captureSpans(span: Span) {
  const contexts: ClassifierSpanContext[] = [];
  const startSpan: ClassifierSpanStarter = async (context, callback) => {
    contexts.push(context);
    return await callback(span);
  };
  return { contexts, startSpan };
}

describe("classifier run span", () => {
  test("groups a run under its conversation id with classifier facts", () => {
    expect(
      buildClassifierRunSpanContext({
        name: "Entity Classifier",
        conversationId: "entity:42",
        attributes: {
          "entity_classifier.entity_id": "42",
        },
      }),
    ).toEqual({
      op: "entity_classifier.run",
      name: "Entity Classifier",
      attributes: {
        "gen_ai.conversation.id": "entity:42",
        "entity_classifier.entity_id": "42",
      },
    });
  });

  // The AI SDK records the agent, model calls, tool calls, and token usage;
  // a second agent span would count each of them twice in Sentry.
  test("is not a second agent span", async () => {
    const capture = captureSpans(
      Sentry.startInactiveSpan({ name: "test run span" }),
    );
    await expect(
      startClassifierRunSpan({
        name: "Entity Classifier",
        conversationId: "entity:123",
        callback: async () => "done",
        startSpan: capture.startSpan,
      }),
    ).resolves.toBe("done");

    expect(capture.contexts).toHaveLength(1);
    expect(capture.contexts[0]?.op).not.toMatch(/^gen_ai\./);
    expect(
      Object.keys(capture.contexts[0]?.attributes ?? {}).filter(
        (key) => key.startsWith("gen_ai.") && key !== "gen_ai.conversation.id",
      ),
    ).toEqual([]);
  });
});
