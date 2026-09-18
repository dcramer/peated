import { createRouterClient } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import { routerClient } from "@peated/server/orpc/router";
import {
  createModerationAutomationProcedure,
  summarizeListingAutomation,
  type ModerationQueueLoader,
} from "@peated/server/orpc/routes/admin/moderation/automation";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getQueueState = vi.fn<ModerationQueueLoader>();
const failedJob = {
  id: "OnBottleChange-abc123",
  name: "OnBottleChange",
  error: 'column "group_id" does not exist',
  failedAt: new Date("2026-09-17T10:00:00.000Z"),
};

describe("admin moderation automation", () => {
  beforeEach(() => {
    getQueueState.mockReset();
    getQueueState.mockResolvedValue({
      counts: { wait: 3, active: 2, completed: 20, failed: 1 },
      failedJobs: [failedJob],
    });
  });

  test("keeps operational failures out of Inbox and exposes recovery locators", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const [check] = await db
      .insert(bottleChecks)
      .values({
        intent: "audit_bottle",
        origin: "moderator",
        bottleId: bottle.id,
        subjectKey: `audit:${bottle.id}:automation-test`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: { summary: "Execution failed", findings: [] },
      })
      .returning();
    const [operation] = await db
      .insert(bottleOperations)
      .values({
        checkId: check!.id,
        proposal: {
          type: "update_entity",
          input: { entityId: bottle.brandId, patch: { name: "Failed brand" } },
          rationale: "Execution test.",
          evidenceRefs: [],
        },
        status: "failed",
        error: "Catalog execution stopped.",
      })
      .returning();
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        status: "failed",
        matchedCount: 8,
        processedCount: 5,
        error: "Worker stopped.",
        createdById: admin.id,
      })
      .returning();

    const inbox = await routerClient.admin.moderation.listTasks(
      { limit: 100 },
      { context: { user: admin } },
    );
    expect(inbox.results).not.toContainEqual(
      expect.objectContaining({ key: `operation:${operation!.id}` }),
    );

    const automationClient = createRouterClient(
      { automation: createModerationAutomationProcedure(getQueueState) },
      { context: { user: admin } },
    );
    const result = await automationClient.automation();
    expect(result.counts).toMatchObject({
      processing: 2,
      waiting: 3,
      failed: 3,
    });
    expect(result.needsAttention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `operation:${operation!.id}`,
          status: "failed",
          title: `Catalog change #${operation!.id}`,
          href: `/admin/moderation/history/operation/${operation!.id}`,
        }),
        expect.objectContaining({
          key: `retry_run:${run!.id}`,
          status: "failed",
          title: `Price retry #${run!.id}`,
        }),
        {
          key: `job:${failedJob.id}`,
          kind: "job",
          title: "Job OnBottleChange",
          status: "failed",
          detail: failedJob.error,
          href: null,
          occurredAt: failedJob.failedAt.toISOString(),
        },
      ]),
    );
    expect(getQueueState).toHaveBeenCalledOnce();
  });

  test("omits catalog failures after their audit is closed", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const [check] = await db
      .insert(bottleChecks)
      .values({
        intent: "audit_bottle",
        origin: "moderator",
        bottleId: bottle.id,
        subjectKey: `audit:${bottle.id}:closed-automation-test`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: { summary: "Execution stopped", findings: [] },
        closedAt: new Date(),
        closedById: admin.id,
        closeReason: "dismissed",
      })
      .returning();
    const [operation] = await db
      .insert(bottleOperations)
      .values({
        checkId: check!.id,
        proposal: {
          type: "update_entity",
          input: { entityId: bottle.brandId, patch: { name: "Stale brand" } },
          rationale: "Execution test.",
          evidenceRefs: [],
        },
        status: "stale",
        error: "Catalog state changed.",
      })
      .returning();

    const automationClient = createRouterClient(
      { automation: createModerationAutomationProcedure(getQueueState) },
      { context: { user: admin } },
    );
    const result = await automationClient.automation();

    expect(result.counts.failed).toBe(1);
    expect(result.needsAttention).not.toContainEqual(
      expect.objectContaining({ key: `operation:${operation!.id}` }),
    );
  });

  test("counts retry health beyond the ten most recent runs", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [failedRun] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        status: "failed",
        error: "Older retry failed.",
        createdById: admin.id,
        completedAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday,
      })
      .returning();
    await db.insert(storePriceMatchRetryRuns).values({
      status: "pending",
      createdById: admin.id,
      createdAt: new Date("2020-01-02T00:00:00.000Z"),
      updatedAt: new Date("2020-01-02T00:00:00.000Z"),
    });
    await db.insert(storePriceMatchRetryRuns).values(
      Array.from({ length: 11 }, (_, index) => ({
        query: `Completed retry ${index + 1}`,
        status: "completed" as const,
        createdById: admin.id,
        completedAt: now,
        createdAt: new Date(now.getTime() + index),
        updatedAt: new Date(now.getTime() + index),
      })),
    );

    const automationClient = createRouterClient(
      { automation: createModerationAutomationProcedure(getQueueState) },
      { context: { user: admin } },
    );
    const result = await automationClient.automation();

    expect(result.counts).toMatchObject({
      processing: 3,
      failed: 2,
      clearedToday: 11,
    });
    expect(result.recentRuns).toHaveLength(10);
    expect(result.needsAttention).toContainEqual(
      expect.objectContaining({
        key: `retry_run:${failedRun!.id}`,
        status: "failed",
      }),
    );
  });

  test("ages out retry failures older than the failed job retention", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const [oldFailure] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        status: "failed",
        error: "Old retry failed.",
        createdById: admin.id,
        completedAt: fourDaysAgo,
        createdAt: fourDaysAgo,
        updatedAt: fourDaysAgo,
      })
      .returning();
    getQueueState.mockResolvedValue({ counts: { failed: 0 }, failedJobs: [] });

    const automationClient = createRouterClient(
      { automation: createModerationAutomationProcedure(getQueueState) },
      { context: { user: admin } },
    );
    const result = await automationClient.automation();

    expect(result.counts.failed).toBe(0);
    expect(result.needsAttention).not.toContainEqual(
      expect.objectContaining({ key: `retry_run:${oldFailure!.id}` }),
    );
  });

  test("reports automatic, manual, and failed listing checks", () => {
    const attempts = [
      {
        proposalType: "no_match" as const,
        initialStatus: "ignored" as const,
        finalStatus: "ignored" as const,
        automationEligible: false,
      },
      {
        proposalType: "match_existing" as const,
        initialStatus: "verified" as const,
        finalStatus: "approved" as const,
        automationEligible: false,
      },
      {
        proposalType: "match_existing" as const,
        initialStatus: "pending_review" as const,
        finalStatus: "approved" as const,
        automationEligible: true,
      },
      {
        proposalType: "create_new" as const,
        initialStatus: "pending_review" as const,
        finalStatus: "approved" as const,
        automationEligible: false,
      },
      {
        proposalType: "create_new" as const,
        initialStatus: "errored" as const,
        finalStatus: "errored" as const,
        automationEligible: false,
      },
    ];

    expect(summarizeListingAutomation(attempts)).toEqual({
      sampleSize: 5,
      automatic: 3,
      manual: 1,
      failed: 1,
      rate: 60,
      byProposalType: [
        {
          proposalType: "match_existing",
          sampleSize: 2,
          automatic: 2,
          manual: 0,
          failed: 0,
          rate: 100,
        },
        {
          proposalType: "create_new",
          sampleSize: 2,
          automatic: 0,
          manual: 1,
          failed: 1,
          rate: 0,
        },
        {
          proposalType: "no_match",
          sampleSize: 1,
          automatic: 1,
          manual: 0,
          failed: 0,
          rate: 100,
        },
      ],
    });
  });
});
