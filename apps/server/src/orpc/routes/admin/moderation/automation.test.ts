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
  type ModerationQueueCountLoader,
} from "@peated/server/orpc/routes/admin/moderation/automation";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getQueueCounts = vi.fn<ModerationQueueCountLoader>();

describe("admin moderation automation", () => {
  beforeEach(() => {
    getQueueCounts.mockReset();
    getQueueCounts.mockResolvedValue({
      wait: 3,
      active: 2,
      completed: 20,
      failed: 1,
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
      { automation: createModerationAutomationProcedure(getQueueCounts) },
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
        }),
        expect.objectContaining({
          key: `retry_run:${run!.id}`,
          status: "failed",
        }),
      ]),
    );
    expect(getQueueCounts).toHaveBeenCalledOnce();
  });

  test("counts retry health beyond the ten most recent runs", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const now = new Date();
    const [failedRun] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        status: "failed",
        error: "Older retry failed.",
        createdById: admin.id,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
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
      { automation: createModerationAutomationProcedure(getQueueCounts) },
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
});
