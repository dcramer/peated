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
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
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
        actorType: "user",
        actorId: userActor.id,
        actorUserId: actorUser.id,
        bottleId: bottle.id,
        releaseId: release.id,
        confidence: 87,
        createdAt: new Date("2026-03-09T10:00:00.000Z"),
      },
      {
        sourceKind: "store_price",
        sourceId: price.id,
        externalSiteId: site.id,
        name: price.name,
        url: price.url,
        decision: "create_bottle",
        actorType: "system",
        actorId: systemActor.id,
        actorUserId: null,
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
    expect(result.results[0]).toMatchObject({
      sourceKind: "store_price",
      sourceId: price.id,
      decision: "create_bottle",
      actorType: "system",
      actor: {
        id: systemActor.id,
        type: "system",
        key: "peated",
        displayName: "Peated",
      },
      actorUser: null,
      bottle: {
        id: bottle.id,
        fullName: bottle.fullName,
      },
      release: null,
      createdBottle: true,
      confidence: 92,
    });
    expect(result.results[1]).toMatchObject({
      sourceKind: "review",
      sourceId: review.id,
      decision: "match_existing",
      actorType: "user",
      actor: {
        id: userActor.id,
        type: "user",
        key: String(actorUser.id),
        displayName: actorUser.username,
      },
      actorUser: {
        id: actorUser.id,
        username: actorUser.username,
      },
      release: {
        id: release.id,
        fullName: release.fullName,
      },
      confidence: 87,
    });
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
        actorType: "user",
        actorId: userActor.id,
        actorUserId: admin.id,
        bottleId: bottle.id,
      },
      {
        sourceKind: "store_price",
        sourceId: 2,
        externalSiteId: site.id,
        name: "System Decision",
        decision: "create_bottle",
        actorType: "system",
        actorId: systemActor.id,
        bottleId: bottle.id,
      },
    ]);

    const result = await routerClient.admin.incomingBottleDecisions(
      { actorType: "system" },
      { context: { user: admin } },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      name: "System Decision",
      actorType: "system",
      actor: {
        id: systemActor.id,
        type: "system",
        key: "peated",
        displayName: "Peated",
      },
    });
  });
});
