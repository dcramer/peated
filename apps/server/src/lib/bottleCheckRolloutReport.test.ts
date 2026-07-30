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
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
          },
          toolCalls: { count: 2 },
          estimatedCostUsd: 0.004,
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
        correctedOperations: 1,
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
        costCoverage: 0.5,
        totalEstimatedCostUsd: 0.004,
      },
    });
  });

  test("uses null rates when a cohort has no denominator", () => {
    expect(buildBottleCheckRolloutReport([])).toMatchObject({
      review: {
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
        costCoverage: 0,
        totalEstimatedCostUsd: null,
      },
    });
  });
});
