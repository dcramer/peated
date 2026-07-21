import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
  incomingBottleDecisionLogs,
} from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact CatalogTarget fixture");
  return target.id;
}

async function genericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: (targets, { and, eq, isNull }) =>
      and(eq(targets.groupId, groupId), isNull(targets.bottleId)),
  });
  if (!target) throw new Error("Missing generic CatalogTarget fixture");
  return target.id;
}

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
    const targetId = await exactTargetId(bottle.id);
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
        targetId,
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
        targetId,
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
      target: {
        kind: "bottle",
        targetId,
        bottle: {
          id: bottle.id,
          fullName: bottle.fullName,
        },
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
      target: {
        kind: "bottle",
        targetId,
        bottle: {
          id: bottle.id,
        },
      },
      confidence: 87,
      model: "decision-model",
      rationale: "Matched by exact identity.",
      metadata: { evidence: "review" },
    });
    expect("bottle" in result.results[0]).toBe(false);
    expect("release" in result.results[0]).toBe(false);
  });

  test("uses the durable exact target when the retained Bottle drifts", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const authoritativeBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    const targetId = await exactTargetId(authoritativeBottle.id);

    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "review",
      sourceId: 101,
      externalSiteId: site.id,
      name: "Drifted decision",
      decision: "match_existing",
      actorId: actor.id,
      bottleId: retainedBottle.id,
      targetId,
    });

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        name: "Drifted decision",
        target: expect.objectContaining({
          kind: "bottle",
          targetId,
          bottle: expect.objectContaining({ id: authoritativeBottle.id }),
        }),
      }),
    ]);
  });

  test("returns a generic target without presenting a representative Bottle", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const retainedBottle = await fixtures.Bottle();
    if (retainedBottle.groupId === null) {
      throw new Error("Missing BottleGroup fixture");
    }
    await fixtures.BottleRelease({ bottleId: retainedBottle.id });
    const targetId = await genericTargetId(retainedBottle.groupId);

    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "review",
      sourceId: 102,
      externalSiteId: site.id,
      name: "Generic decision",
      decision: "match_existing",
      actorId: actor.id,
      bottleId: retainedBottle.id,
      targetId,
    });

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        name: "Generic decision",
        target: expect.objectContaining({
          kind: "group",
          targetId,
          group: expect.objectContaining({ id: retainedBottle.groupId }),
        }),
      }),
    ]);
    expect("bottle" in result.results[0]).toBe(false);
    expect("release" in result.results[0]).toBe(false);
  });

  test("resolves a promoted retained release as parity evidence for its exact target", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const parent = await fixtures.Bottle();
    if (parent.groupId === null) throw new Error("Missing BottleGroup fixture");
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        name: `${parent.name} promoted`,
        fullName: `${parent.fullName} promoted`,
        createdByActorId: parent.createdByActorId,
      })
      .returning();
    if (!promotedBottle) throw new Error("Missing promoted Bottle fixture");
    const [target] = await db
      .insert(catalogTargets)
      .values({ groupId: parent.groupId, bottleId: promotedBottle.id })
      .returning();
    if (!target) throw new Error("Missing promoted CatalogTarget fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "store_price",
      sourceId: 103,
      externalSiteId: site.id,
      name: "Historical release decision",
      decision: "create_release",
      actorId: actor.id,
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
      createdRelease: true,
    });

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        decision: "create_release",
        createdRelease: true,
        target: expect.objectContaining({
          kind: "bottle",
          targetId: target.id,
          bottle: expect.objectContaining({ id: promotedBottle.id }),
        }),
      }),
    ]);
  });

  test("keeps a targetless historical decision explicitly unknown", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const retainedBottle = await fixtures.Bottle();

    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "review",
      sourceId: 104,
      externalSiteId: site.id,
      name: "Targetless decision",
      decision: "match_existing",
      actorId: actor.id,
      bottleId: retainedBottle.id,
      targetId: null,
    });

    const result = await routerClient.admin.incomingBottleDecisions(undefined, {
      context: { user: admin },
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        name: "Targetless decision",
        target: null,
      }),
    ]);
  });

  test("fails closed when a durable target is retired", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const actor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle();
    const targetId = await exactTargetId(bottle.id);

    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "review",
      sourceId: 105,
      externalSiteId: site.id,
      name: "Retired target decision",
      decision: "match_existing",
      actorId: actor.id,
      bottleId: bottle.id,
      targetId,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
    });

    const error = await waitError(
      routerClient.admin.incomingBottleDecisions(undefined, {
        context: { user: admin },
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Catalog target is retired (bottleId=${bottle.id}).`,
    });
  });

  test("filters by actor type", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const userActor = await getUserActor(admin);
    const systemActor = await getPeatedSystemActor();
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle();
    const targetId = await exactTargetId(bottle.id);

    await db.insert(incomingBottleDecisionLogs).values([
      {
        sourceKind: "review",
        sourceId: 1,
        externalSiteId: site.id,
        name: "User Decision",
        decision: "match_existing",
        actorId: userActor.id,
        bottleId: bottle.id,
        targetId,
      },
      {
        sourceKind: "store_price",
        sourceId: 2,
        externalSiteId: site.id,
        name: "System Decision",
        decision: "create_bottle",
        actorId: systemActor.id,
        bottleId: bottle.id,
        targetId,
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
    const targetId = await exactTargetId(bottle.id);
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
          targetId,
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
          targetId,
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
      targetId,
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
