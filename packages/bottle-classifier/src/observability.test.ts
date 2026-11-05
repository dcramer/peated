import type { Span } from "@sentry/core";
import * as Sentry from "@sentry/core";
import { describe, expect, test, vi } from "vitest";
import {
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
} from "./contract";
import {
  buildClassifierRunSpanContext,
  type ClassifierSpanContext,
  type ClassifierSpanStarter,
  recordReferenceRunOutcome,
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

describe("reference run outcome", () => {
  test("records the path, decision, and open risk categories as fixed values", () => {
    const span = { setAttributes: vi.fn() };
    recordReferenceRunOutcome({
      path: "agent",
      span,
      result: createDecidedBottleClassification({
        decision: {
          action: "match",
          matchedBottleId: 7,
          candidateBottleIds: [7, 8],
          rationale: "The label names this release.",
          identityScope: "product",
          referenceScope: "none",
          observation: null,
          proposedBottle: null,
          confidenceBasis: {
            webEvidence: "supportive",
            unresolvedRisks: [
              { category: "identity_ambiguity", note: "Two ages." },
              { category: "trait_conflict", note: "ABV differs." },
              { category: "identity_ambiguity", note: "Two labels." },
            ],
          },
        },
        artifacts: {},
      }),
    });

    expect(span.setAttributes).toHaveBeenCalledWith({
      "bottle_classifier.path": "agent",
      "bottle_classifier.status": "classified",
      "bottle_classifier.action": "match",
      "bottle_classifier.identity_scope": "product",
      "bottle_classifier.web_evidence": "supportive",
      "bottle_classifier.risk_categories": [
        "identity_ambiguity",
        "trait_conflict",
      ],
      "bottle_classifier.risk_count": 3,
      "bottle_classifier.candidate_count": 0,
    });
  });

  test("records an ignore without its reason text", () => {
    const span = { setAttributes: vi.fn() };
    recordReferenceRunOutcome({
      path: "scope_precheck",
      span,
      result: createIgnoredBottleClassification({
        reason: "The scope pre-check found a sample.",
        artifacts: {},
      }),
    });

    const [attributes] = span.setAttributes.mock.calls[0]!;
    expect(attributes).toMatchObject({
      "bottle_classifier.path": "scope_precheck",
      "bottle_classifier.status": "ignored",
      "bottle_classifier.action": "ignore",
    });
    expect(JSON.stringify(attributes)).not.toContain("sample");
  });

  test("does nothing without a span", () => {
    expect(() =>
      recordReferenceRunOutcome({
        path: "rule",
        result: createIgnoredBottleClassification({
          reason: "A bundle.",
          artifacts: {},
        }),
      }),
    ).not.toThrow();
  });
});
