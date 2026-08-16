import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  storePriceMatchAttempts,
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
      inconclusive: 0,
    });
    await expect(
      routerClient.admin.moderation.task(
        { key: `listing:${listing!.id}` },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      task: expect.objectContaining({ key: `listing:${listing!.id}` }),
    });
    await expect(
      routerClient.admin.moderation.task(
        { key: `operation:${operations[0]!.id}` },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      task: expect.objectContaining({ key: `operation:${operations[0]!.id}` }),
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
    expect(blocked.counts).toMatchObject({ all: 3, blocked: 1 });

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

  test("filters and bulk-ignores only actionable inconclusive listings", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const inconclusivePrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Unresolved listing",
    });
    const matchedPrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Matched listing",
    });
    const processingPrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Processing unresolved listing",
    });
    const hiddenPrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      hidden: true,
      name: "Hidden unresolved listing",
    });
    const [inconclusive, matched, processing, hidden] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: inconclusivePrice.id,
          proposalType: "no_match",
          status: "pending_review",
        },
        {
          priceId: matchedPrice.id,
          proposalType: "match_existing",
          status: "pending_review",
        },
        {
          priceId: processingPrice.id,
          proposalType: "no_match",
          status: "pending_review",
          processingExpiresAt: new Date(Date.now() + 60_000),
          processingToken: "active-classification",
        },
        {
          priceId: hiddenPrice.id,
          proposalType: "no_match",
          status: "pending_review",
        },
      ])
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: inconclusivePrice.id,
        proposalId: inconclusive!.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
      })
      .returning();

    const filtered = await routerClient.admin.moderation.listTasks(
      { inconclusive: true },
      { context: { user: admin } },
    );
    expect(filtered.results).toEqual([
      expect.objectContaining({
        key: `listing:${inconclusive!.id}`,
        inconclusive: true,
        question: "No Bottle match was found. Should this listing be ignored?",
        statusLabel: "Inconclusive",
      }),
    ]);
    expect(filtered.counts.inconclusive).toBe(1);

    await expect(
      routerClient.admin.moderation.ignoreInconclusive(
        {},
        { context: { user: await fixtures.User({ mod: true }) } },
      ),
    ).rejects.toThrow("Unauthorized");

    await expect(
      routerClient.admin.moderation.ignoreInconclusive(
        {},
        { context: { user: admin } },
      ),
    ).resolves.toEqual({ ignored: 1 });

    const proposals = await db.query.storePriceMatchProposals.findMany();
    expect(
      Object.fromEntries(proposals.map(({ id, status }) => [id, status])),
    ).toMatchObject({
      [inconclusive!.id]: "ignored",
      [matched!.id]: "pending_review",
      [processing!.id]: "pending_review",
      [hidden!.id]: "pending_review",
    });
    await expect(
      db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt!.id),
      }),
    ).resolves.toMatchObject({
      finalStatus: "ignored",
      reviewedById: admin.id,
    });
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
      expect.objectContaining({
        key: `finding:${check!.id}`,
        kind: "finding",
        statusLabel: "1 finding",
      }),
    ]);
    await expect(
      routerClient.admin.moderation.task(
        { key: `finding:${check!.id}` },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      task: expect.objectContaining({ key: `finding:${check!.id}` }),
    });
  });
});
