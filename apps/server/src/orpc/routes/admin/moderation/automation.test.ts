import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({ getQueue: vi.fn() }));

describe("admin moderation automation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(workerClient.getQueue).mockResolvedValue({
      getJobCounts: vi.fn().mockResolvedValue({
        wait: 3,
        active: 2,
        completed: 20,
        failed: 1,
      }),
    } as never);
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

    const result = await routerClient.admin.moderation.automation(undefined, {
      context: { user: admin },
    });
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
    expect(workerClient.getQueue).toHaveBeenCalledWith("default");
  });
});
