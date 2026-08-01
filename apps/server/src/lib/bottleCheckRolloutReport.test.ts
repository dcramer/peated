import { describe, expect, test } from "vitest";
import {
  buildBottleCheckRolloutReport,
  type BottleCheckRolloutRow,
} from "./bottleCheckRolloutReport";

function row(
  overrides: Partial<BottleCheckRolloutRow> = {},
): BottleCheckRolloutRow {
  return {
    intent: "audit_bottle",
    schemaVersion: 1,
    model: "gpt-test",
    modelMetadata: null,
    completedAt: new Date("2026-07-01T00:00:00.000Z"),
    operations: [],
    ...overrides,
  };
}

describe("buildBottleCheckRolloutReport", () => {
  test("summarizes review, execution, and model measurements without hiding coverage", () => {
    const report = buildBottleCheckRolloutReport([
      row({
        modelMetadata: {
          agentDurationMs: 500,
          usage: {
            requests: 1,
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
          },
          toolCalls: {
            count: 2,
            names: ["get_bottle_context", "propose_update_bottle"],
          },
        },
        operations: [
          {
            status: "rejected",
            reviewedAt: new Date("2026-07-01T00:02:00.000Z"),
            rejectionReason: "wrong_change",
          },
          {
            status: "stale",
            reviewedAt: null,
            rejectionReason: null,
          },
        ],
      }),
      row({
        intent: "resolve_reference",
        modelMetadata: null,
        operations: [
          {
            status: "failed",
            reviewedAt: new Date("2026-07-01T00:04:00.000Z"),
            rejectionReason: null,
          },
        ],
      }),
    ]);

    expect(report).toEqual({
      checks: {
        total: 2,
        byIntent: {
          audit_bottle: 1,
          resolve_reference: 1,
        },
        bySchemaVersion: { "1": 2 },
      },
      review: {
        reviewedOperations: 2,
        acceptedOperations: 1,
        rejectedOperations: 1,
        correctedOperations: 1,
        acceptanceRate: 0.5,
        rejectionRate: 0.5,
        correctionRate: 0.5,
        averageReviewTimeMs: 180_000,
        rejectionReasons: { wrong_change: 1 },
      },
      execution: {
        operations: 3,
        attemptedOperations: 2,
        staleOperations: 1,
        staleRate: 0.5,
        failedOperations: 1,
        failureRate: 0.5,
      },
      model: {
        measuredRuns: 1,
        latencyCoverage: 0.5,
        averageAgentLatencyMs: 500,
        totalInputTokens: 100,
        totalOutputTokens: 20,
        totalTokens: 120,
        totalToolCalls: 2,
        usageByModel: {
          "gpt-test": {
            runs: 1,
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            toolCalls: 2,
          },
        },
      },
    });
  });

  test("uses null rates when a cohort has no denominator", () => {
    expect(buildBottleCheckRolloutReport([])).toMatchObject({
      review: {
        acceptanceRate: null,
        rejectionRate: null,
        correctionRate: null,
        averageReviewTimeMs: null,
      },
      execution: {
        staleRate: null,
        failureRate: null,
      },
      model: {
        latencyCoverage: 0,
        averageAgentLatencyMs: null,
      },
    });
  });

  test("separates rejection from an explicit proposal correction", () => {
    const report = buildBottleCheckRolloutReport([
      row({
        operations: [
          {
            status: "rejected",
            reviewedAt: new Date("2026-07-01T00:01:00.000Z"),
            rejectionReason: "resolved_manually",
          },
        ],
      }),
    ]);

    expect(report.review).toMatchObject({
      reviewedOperations: 1,
      acceptedOperations: 0,
      rejectedOperations: 1,
      correctedOperations: 0,
      acceptanceRate: 0,
      rejectionRate: 1,
      correctionRate: 0,
    });
  });

  test("derives every review outcome from the reviewed cohort", () => {
    const report = buildBottleCheckRolloutReport([
      row({
        operations: [
          {
            status: "rejected",
            reviewedAt: null,
            rejectionReason: "wrong_change",
          },
        ],
      }),
    ]);

    expect(report.review).toEqual({
      reviewedOperations: 0,
      acceptedOperations: 0,
      rejectedOperations: 0,
      correctedOperations: 0,
      acceptanceRate: null,
      rejectionRate: null,
      correctionRate: null,
      averageReviewTimeMs: null,
      rejectionReasons: {},
    });
  });

  test("rejects malformed persisted model metadata", () => {
    expect(() =>
      buildBottleCheckRolloutReport([
        row({
          modelMetadata: {
            agentDurationMs: 10,
            usage: { totalTokens: 12 },
            toolCalls: { count: 1 },
          },
        }),
      ]),
    ).toThrow();
  });
});
