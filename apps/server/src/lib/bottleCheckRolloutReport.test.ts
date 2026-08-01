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
    origin: "moderator",
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
            cachedInputTokens: 40,
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
            type: "update_bottle",
            status: "rejected",
            reviewedAt: new Date("2026-07-01T00:02:00.000Z"),
            rejectionReason: "wrong_change",
          },
          {
            type: "merge_bottles",
            status: "stale",
            reviewedAt: null,
            rejectionReason: null,
          },
        ],
      }),
      row({
        intent: "resolve_reference",
        origin: "source",
        modelMetadata: null,
        operations: [
          {
            type: "merge_entities",
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
        byOrigin: { moderator: 1, source: 1 },
        bySchemaVersion: { "1": 2 },
      },
      review: {
        reviewedOperations: 2,
        acceptedOperations: 1,
        rejectedOperations: 1,
        qualityRejections: 1,
        acceptanceRate: 0.5,
        rejectionRate: 0.5,
        qualityRejectionRate: 0.5,
        averageReviewTimeMs: 180_000,
        rejectionReasons: { wrong_change: 1 },
      },
      execution: {
        operations: 3,
        byOperationType: {
          update_bottle: 1,
          merge_bottles: 1,
          merge_entities: 1,
        },
        attemptedOperations: 2,
        staleOperations: 1,
        staleRate: 0.5,
        failedOperations: 1,
        failureRate: 0.5,
      },
      agentLoop: {
        measuredRuns: 1,
        latencyCoverage: 0.5,
        cacheDetailRuns: 1,
        cacheDetailCoverage: 1,
        averageAgentLatencyMs: 500,
        totalInputTokens: 100,
        totalCachedInputTokens: 40,
        cachedInputTokenRate: 0.4,
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
        qualityRejectionRate: null,
        averageReviewTimeMs: null,
      },
      execution: {
        staleRate: null,
        failureRate: null,
      },
      agentLoop: {
        latencyCoverage: 0,
        cacheDetailCoverage: 0,
        cachedInputTokenRate: null,
        averageAgentLatencyMs: null,
      },
    });
  });

  test("reports cache rates only across runs with provider cache detail", () => {
    const metadata = (cachedInputTokens?: number) => ({
      agentDurationMs: 100,
      usage: {
        requests: 1,
        inputTokens: 100,
        ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
        outputTokens: 10,
        totalTokens: 110,
      },
      toolCalls: { count: 0, names: [] },
    });
    const report = buildBottleCheckRolloutReport([
      row({ modelMetadata: metadata(50) }),
      row({ modelMetadata: metadata() }),
    ]);

    expect(report.agentLoop).toMatchObject({
      measuredRuns: 2,
      cacheDetailRuns: 1,
      cacheDetailCoverage: 0.5,
      totalCachedInputTokens: 50,
      cachedInputTokenRate: 0.5,
    });
  });

  test("separates general rejections from quality rejections", () => {
    const report = buildBottleCheckRolloutReport([
      row({
        operations: [
          {
            type: "update_entity",
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
      qualityRejections: 0,
      acceptanceRate: 0,
      rejectionRate: 1,
      qualityRejectionRate: 0,
    });
  });

  test("derives every review outcome from the reviewed cohort", () => {
    const report = buildBottleCheckRolloutReport([
      row({
        operations: [
          {
            type: "update_bottle",
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
      qualityRejections: 0,
      acceptanceRate: null,
      rejectionRate: null,
      qualityRejectionRate: null,
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
