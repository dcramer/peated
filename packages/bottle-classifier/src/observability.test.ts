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
        name: "Bottle Classifier",
        conversationId: "photo_identification:pending-1",
        attributes: {
          "bottle_classifier.reference_id": "pending-1",
        },
      }),
    ).toEqual({
      op: "bottle_classifier.run",
      name: "Bottle Classifier",
      attributes: {
        "gen_ai.conversation.id": "photo_identification:pending-1",
        "bottle_classifier.reference_id": "pending-1",
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
        name: "Bottle Classifier",
        conversationId: "bottle_reference:123",
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
