import { db } from "@peated/server/db";
import { incomingBottleDecisionLogs } from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /admin/incoming-bottle-decisions", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.admin.incomingBottleDecisions(),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin privileges", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.admin.incomingBottleDecisions(undefined, {
        context: { user },
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists incoming bottle decisions", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const actorUser = await fixtures.User({ username: "moderator" });
    const userActor = await getUserActor(actorUser);
    const systemActor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Decision Price",
      url: "https://example.com/decision-price",
    });
    const review = await fixtures.Review({
      bottleId: null,
      externalSiteId: site.id,
      name: "Decision Review",
      url: "https://example.com/decision-review",
    });

    await db.insert(incomingBottleDecisionLogs).values([
      {
        sourceKind: "review",
        sourceId: review.id,
        externalSiteId: site.id,
        name: review.name,
        url: review.url,
        decision: "match_existing",
        actorId: userActor.id,
        bottleId: bottle.id,
        confidence: 87,
        model: "decision-model",
        rationale: "Matched by exact identity.",
        metadata: { evidence: "review" },
        createdAt: new Date("2026-03-09T10:00:00.000Z"),
      },
      {
        sourceKind: "store_price",
        sourceId: price.id,
        externalSiteId: site.id,
        name: price.name,
        url: price.url,
        decision: "create_bottle",
        actorId: systemActor.id,
        bottleId: bottle.id,
        createdBottle: true,
        confidence: 92,
        createdAt: new Date("2026-03-09T11:00:00.000Z"),
      },
    ]);

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toHaveLength(2);
    expect("actorType" in result.results[0]).toBe(false);
    expect("actorUser" in result.results[0]).toBe(false);
    expect(result.results[0].bottle).toEqual({
      id: bottle.id,
      fullName: bottle.fullName,
    });
    expect(result.results[0]).toMatchObject({
      sourceKind: "store_price",
      sourceId: price.id,
      decision: "create_bottle",
      actor: {
        id: systemActor.id,
        type: "system",
        key: "peated",
        displayName: "Peated",
      },
      bottle: {
        id: bottle.id,
        fullName: bottle.fullName,
      },
      createdBottle: true,
      confidence: 92,
    });
    expect(result.results[1]).toMatchObject({
      sourceKind: "review",
      sourceId: review.id,
      decision: "match_existing",
      actor: {
        id: userActor.id,
        type: "user",
        key: String(actorUser.id),
        displayName: actorUser.username,
      },
      bottle: {
        id: bottle.id,
      },
      confidence: 87,
      model: "decision-model",
      rationale: "Matched by exact identity.",
      metadata: { evidence: "review" },
    });
    expect("target" in result.results[0]).toBe(false);
    expect("release" in result.results[0]).toBe(false);
  });

  test("uses Bottle identity for historical decision kinds", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle();
    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "store_price",
      sourceId: 105,
      externalSiteId: site.id,
      name: "Historical release decision",
      decision: "create_release",
      actorId: actor.id,
      bottleId: bottle.id,
      createdRelease: true,
    });

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        decision: "create_release",
        createdRelease: true,
        bottle: expect.objectContaining({ id: bottle.id }),
      }),
    ]);
    expect("target" in result.results[0]).toBe(false);
  });

  test("preserves decisions for deleted bottles", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "store_price",
      sourceId: 106,
      externalSiteId: site.id,
      name: "Deleted invalid bottle decision",
      decision: "create_bottle",
      actorId: actor.id,
      bottleId: null,
      createdBottle: true,
    });

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        sourceId: 106,
        bottle: null,
        createdBottle: true,
      }),
    ]);
  });

  test("filters by actor type", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const userActor = await getUserActor(admin);
    const systemActor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle();

    await db.insert(incomingBottleDecisionLogs).values([
      {
        sourceKind: "review",
        sourceId: 1,
        externalSiteId: site.id,
        name: "User Decision",
        decision: "match_existing",
        actorId: userActor.id,
        bottleId: bottle.id,
      },
      {
        sourceKind: "store_price",
        sourceId: 2,
        externalSiteId: site.id,
        name: "System Decision",
        decision: "create_bottle",
        actorId: systemActor.id,
        bottleId: bottle.id,
      },
    ]);

    const result = await routerClient.admin.incomingBottleDecisions(
      { actor: "system" },
      { context: { user: admin } },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      name: "System Decision",
      actor: {
        id: systemActor.id,
        type: "system",
        key: "peated",
        displayName: "Peated",
      },
    });
  });

  test("filters by source and preserves deterministic pagination order", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle();
    const [olderReview, newerReview] = await db
      .insert(incomingBottleDecisionLogs)
      .values([
        {
          sourceKind: "review",
          sourceId: 201,
          externalSiteId: site.id,
          name: "Older review decision",
          decision: "match_existing",
          actorId: actor.id,
          bottleId: bottle.id,
          createdAt: new Date("2026-03-09T10:00:00.000Z"),
        },
        {
          sourceKind: "review",
          sourceId: 202,
          externalSiteId: site.id,
          name: "Newer review decision",
          decision: "match_existing",
          actorId: actor.id,
          bottleId: bottle.id,
          createdAt: new Date("2026-03-09T11:00:00.000Z"),
        },
      ])
      .returning();
    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "store_price",
      sourceId: 203,
      externalSiteId: site.id,
      name: "Excluded price decision",
      decision: "match_existing",
      actorId: actor.id,
      bottleId: bottle.id,
      createdAt: new Date("2026-03-09T12:00:00.000Z"),
    });
    if (!olderReview || !newerReview) {
      throw new Error("Missing decision fixtures");
    }

    const firstPage = await routerClient.admin.incomingBottleDecisions(
      { sourceKind: "review", limit: 1, cursor: 1 },
      { context: { user: admin } },
    );
    const secondPage = await routerClient.admin.incomingBottleDecisions(
      { sourceKind: "review", limit: 1, cursor: 2 },
      { context: { user: admin } },
    );

    expect(firstPage.results.map(({ id }) => id)).toEqual([newerReview.id]);
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results.map(({ id }) => id)).toEqual([olderReview.id]);
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });
});
