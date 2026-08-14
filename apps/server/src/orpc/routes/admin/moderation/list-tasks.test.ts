import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  storePriceMatchProposals,
} from "@peated/server/db/schema";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("admin moderation tasks", () => {
  test("requires administrator privileges", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    expect(
      await waitError(() => routerClient.admin.moderation.listTasks()),
    ).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(
      await waitError(() =>
        routerClient.admin.moderation.listTasks(undefined, {
          context: { user: moderator },
        }),
      ),
    ).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("projects one oldest-first task per human decision", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Oldest listing",
    });
    const [listing] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "match_existing",
        status: "pending_review",
        enteredQueueAt: new Date("2026-01-01T00:00:00.000Z"),
      })
      .returning();
    const bottle = await fixtures.Bottle();
    const [check] = await db
      .insert(bottleChecks)
      .values({
        intent: "audit_bottle",
        origin: "moderator",
        bottleId: bottle.id,
        subjectKey: `audit:${bottle.id}:moderation-test`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: { summary: "Review changes", findings: [] },
        completedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      })
      .returning();
    const operations = await db
      .insert(bottleOperations)
      .values([
        {
          checkId: check!.id,
          proposal: {
            type: "update_entity",
            input: { entityId: bottle.brandId, patch: { name: "First" } },
            rationale: "First independent change.",
            evidenceRefs: [],
          },
          status: "pending_review",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          checkId: check!.id,
          proposal: {
            type: "update_entity",
            input: { entityId: bottle.brandId, patch: { name: "Second" } },
            rationale: "Second independent change.",
            evidenceRefs: [],
          },
          status: "blocked",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ])
      .returning();

    const result = await routerClient.admin.moderation.listTasks(
      { limit: 100 },
      { context: { user: admin } },
    );

    expect(result.results.map(({ key }) => key)).toEqual([
      `listing:${listing!.id}`,
      `operation:${operations[0]!.id}`,
      `operation:${operations[1]!.id}`,
    ]);
    expect(result.counts).toMatchObject({
      all: 3,
      listing: 1,
      catalog: 2,
      blocked: 1,
    });

    const blocked = await routerClient.admin.moderation.listTasks(
      { blocked: true },
      { context: { user: admin } },
    );
    expect(blocked.results).toEqual([
      expect.objectContaining({
        key: `operation:${operations[1]!.id}`,
        state: "blocked",
      }),
    ]);

    await db
      .update(bottleOperations)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(eq(bottleOperations.id, operations[0]!.id));
    const error = await waitError(() =>
      routerClient.admin.moderation.task(
        { key: `operation:${operations[0]!.id}` },
        { context: { user: admin } },
      ),
    );
    expect(error.message).toBe(
      "This moderation task no longer needs attention.",
    );
  });

  test("projects findings only after independent operations are resolved", async ({
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
        subjectKey: `audit:${bottle.id}:finding-test`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: {
          summary: "Finding remains",
          findings: [{ summary: "Name needs review" }],
        },
        completedAt: new Date(),
      })
      .returning();

    const result = await routerClient.admin.moderation.listTasks(
      { query: `finding:${check!.id}` },
      { context: { user: admin } },
    );
    expect(result.results).toEqual([
      expect.objectContaining({ key: `finding:${check!.id}`, kind: "finding" }),
    ]);
  });
});
