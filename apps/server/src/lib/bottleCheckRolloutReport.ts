import { db, type AnyDatabase } from "@peated/server/db";
import { bottleChecks } from "@peated/server/db/schema";
import { gte } from "drizzle-orm";

type RolloutOperation = {
  status:
    | "blocked"
    | "pending_review"
    | "rejected"
    | "applying"
    | "applied"
    | "stale"
    | "failed";
  reviewedAt: Date | null;
  rejectionReason:
    | "wrong_target"
    | "wrong_change"
    | "insufficient_evidence"
    | "resolved_manually"
    | "other"
    | null;
};

export type BottleCheckRolloutRow = {
  intent: "resolve_reference" | "audit_bottle";
  schemaVersion: number;
  model: string | null;
  modelMetadata: Record<string, unknown> | null;
  completedAt: Date | null;
  operations: RolloutOperation[];
};

type CountByKey = Record<string, number>;
type UsageByModel = Record<
  string,
  {
    runs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    toolCalls: number;
  }
>;

export type BottleCheckRolloutReport = {
  checks: {
    total: number;
    byIntent: CountByKey;
    bySchemaVersion: CountByKey;
  };
  review: {
    reviewedOperations: number;
    correctedOperations: number;
    correctionRate: number | null;
    averageReviewTimeMs: number | null;
    rejectionReasons: CountByKey;
  };
  execution: {
    operations: number;
    attemptedOperations: number;
    staleOperations: number;
    staleRate: number | null;
    failedOperations: number;
    failureRate: number | null;
  };
  model: {
    measuredRuns: number;
    latencyCoverage: number;
    averageAgentLatencyMs: number | null;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalToolCalls: number;
    usageByModel: UsageByModel;
  };
};

function increment(counts: CountByKey, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function objectProperty(
  value: Record<string, unknown> | null,
  property: string,
): Record<string, unknown> | null {
  const candidate = value?.[property];
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

function finiteNumber(
  value: Record<string, unknown> | null,
  property: string,
): number | null {
  const candidate = value?.[property];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function buildBottleCheckRolloutReport(
  rows: BottleCheckRolloutRow[],
): BottleCheckRolloutReport {
  const byIntent: CountByKey = {};
  const bySchemaVersion: CountByKey = {};
  const rejectionReasons: CountByKey = {};
  const reviewTimesMs: number[] = [];
  const latenciesMs: number[] = [];
  let operationCount = 0;
  let attemptedOperations = 0;
  let reviewedOperations = 0;
  let correctedOperations = 0;
  let staleOperations = 0;
  let failedOperations = 0;
  let measuredRuns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalToolCalls = 0;
  const usageByModel: UsageByModel = {};

  for (const row of rows) {
    increment(byIntent, row.intent);
    increment(bySchemaVersion, String(row.schemaVersion));

    const usage = objectProperty(row.modelMetadata, "usage");
    const toolCalls = objectProperty(row.modelMetadata, "toolCalls");
    if (row.modelMetadata) {
      measuredRuns += 1;
      const model = row.model ?? "unknown";
      const modelUsage = (usageByModel[model] ??= {
        runs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        toolCalls: 0,
      });
      modelUsage.runs += 1;
      modelUsage.inputTokens += finiteNumber(usage, "inputTokens") ?? 0;
      modelUsage.outputTokens += finiteNumber(usage, "outputTokens") ?? 0;
      modelUsage.totalTokens += finiteNumber(usage, "totalTokens") ?? 0;
      modelUsage.toolCalls += finiteNumber(toolCalls, "count") ?? 0;
    }

    const durationMs = finiteNumber(row.modelMetadata, "agentDurationMs");
    if (durationMs !== null) {
      latenciesMs.push(durationMs);
    }
    totalInputTokens += finiteNumber(usage, "inputTokens") ?? 0;
    totalOutputTokens += finiteNumber(usage, "outputTokens") ?? 0;
    totalTokens += finiteNumber(usage, "totalTokens") ?? 0;
    totalToolCalls += finiteNumber(toolCalls, "count") ?? 0;

    for (const operation of row.operations) {
      operationCount += 1;
      if (
        operation.status === "applying" ||
        operation.status === "applied" ||
        operation.status === "stale" ||
        operation.status === "failed"
      ) {
        attemptedOperations += 1;
      }
      if (operation.status === "stale") {
        staleOperations += 1;
      }
      if (operation.status === "failed") {
        failedOperations += 1;
      }
      if (operation.reviewedAt) {
        reviewedOperations += 1;
        if (row.completedAt) {
          reviewTimesMs.push(
            Math.max(
              0,
              operation.reviewedAt.getTime() - row.completedAt.getTime(),
            ),
          );
        }
      }
      if (operation.status === "rejected") {
        correctedOperations += 1;
        increment(rejectionReasons, operation.rejectionReason ?? "unspecified");
      }
    }
  }

  return {
    checks: {
      total: rows.length,
      byIntent,
      bySchemaVersion,
    },
    review: {
      reviewedOperations,
      correctedOperations,
      correctionRate: ratio(correctedOperations, reviewedOperations),
      averageReviewTimeMs:
        reviewTimesMs.length === 0
          ? null
          : reviewTimesMs.reduce((sum, value) => sum + value, 0) /
            reviewTimesMs.length,
      rejectionReasons,
    },
    execution: {
      operations: operationCount,
      attemptedOperations,
      staleOperations,
      staleRate: ratio(staleOperations, attemptedOperations),
      failedOperations,
      failureRate: ratio(failedOperations, attemptedOperations),
    },
    model: {
      measuredRuns,
      latencyCoverage: ratio(latenciesMs.length, rows.length) ?? 0,
      averageAgentLatencyMs:
        latenciesMs.length === 0
          ? null
          : latenciesMs.reduce((sum, value) => sum + value, 0) /
            latenciesMs.length,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalToolCalls,
      usageByModel,
    },
  };
}

export async function getBottleCheckRolloutReport({
  since,
  database = db,
}: {
  since: Date;
  database?: AnyDatabase;
}): Promise<BottleCheckRolloutReport> {
  const rows = await database.query.bottleChecks.findMany({
    where: gte(bottleChecks.createdAt, since),
    columns: {
      intent: true,
      schemaVersion: true,
      model: true,
      modelMetadata: true,
      completedAt: true,
    },
    with: {
      operations: {
        columns: {
          status: true,
          reviewedAt: true,
          rejectionReason: true,
        },
      },
    },
  });

  return buildBottleCheckRolloutReport(rows);
}
