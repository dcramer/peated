import { db } from "@peated/server/db";
import {
  actors,
  bottleGroups,
  bottleReleasePromotions,
  bottles,
  catalogTargets,
  type Bottle,
} from "@peated/server/db/schema";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetInvalidMappingError,
} from "@peated/server/lib/catalogTargets";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function targetIds(bottleId: number, groupId: number) {
  const [exact, generic] = await Promise.all([
    db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottleId),
    }),
    db.query.catalogTargets.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.groupId, groupId), isNull(table.bottleId)),
    }),
  ]);
  if (!exact || !generic) throw new Error("Missing target fixture");
  return { exact: exact.id, generic: generic.id };
}

async function promoteRelease(parent: Bottle, releaseId: number) {
  const [promoted] = await db
    .insert(bottles)
    .values({
      groupId: parent.groupId,
      brandId: parent.brandId,
      name: `${parent.name} promoted`,
      fullName: `${parent.fullName} promoted`,
      createdByActorId: parent.createdByActorId,
    })
    .returning();
  if (!promoted) throw new Error("Missing promoted Bottle fixture");
  const [target] = await db
    .insert(catalogTargets)
    .values({ groupId: parent.groupId as number, bottleId: promoted.id })
    .returning();
  if (!target) throw new Error("Missing promoted target fixture");
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: promoted.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return { promoted, target };
}

describe("GET /tastings", () => {
  test("lists tastings", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();
    await fixtures.Tasting();

    const { results } = await routerClient.tastings.list();

    expect(results.length).toBe(2);
    const result = results.find(({ id }) => id === tasting.id)!;
    expect(result.target).toMatchObject({
      kind: "bottle",
      bottle: { id: tasting.bottleId },
    });
    expect(result).not.toHaveProperty("bottle");
    expect(result).not.toHaveProperty("release");
  });

  test("rejects a targetless tasting instead of falling back", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.Tasting({ bottleId: bottle.id, targetId: null });

    const error = await waitError(routerClient.tastings.list());

    expect(error).toBeInstanceOf(CatalogTargetIntegrityMismatchError);
    expect(error).toMatchObject({
      code: "CATALOG_TARGET_INTEGRITY_MISMATCH",
      identity: { bottleId: bottle.id },
    });
  });

  test("authenticated serialization does not mutate the user's Actor", async ({
    fixtures,
  }) => {
    await fixtures.Tasting();
    const currentUser = await fixtures.User();
    const sentinel = {
      active: false,
      displayName: "tasting read sentinel",
    } as const;
    await db
      .update(actors)
      .set(sentinel)
      .where(eq(actors.userId, currentUser.id));
    const [{ count: before }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);

    await routerClient.tastings.list({}, { context: { user: currentUser } });

    const [{ count: after }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);
    const actor = await db.query.actors.findFirst({
      where: eq(actors.userId, currentUser.id),
      columns: { active: true, displayName: true },
    });
    expect(after).toBe(before);
    expect(actor).toEqual(sentinel);
  });

  test("lists tastings with bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const { exact } = await targetIds(bottle.id, bottle.groupId as number);
    const { exact: otherExact } = await targetIds(
      otherBottle.id,
      otherBottle.groupId as number,
    );
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    const targetOnly = await fixtures.Tasting({
      bottleId: otherBottle.id,
      targetId: exact,
    });
    const legacyOnly = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: otherExact,
    });

    const firstPage = await routerClient.tastings.list({
      bottle: bottle.id,
      limit: 1,
    });
    const secondPage = await routerClient.tastings.list({
      bottle: bottle.id,
      cursor: 2,
      limit: 1,
    });
    const thirdPage = await routerClient.tastings.list({
      bottle: bottle.id,
      cursor: 3,
      limit: 1,
    });
    const results = [...firstPage.results, ...secondPage.results];

    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([tasting.id, targetOnly.id]),
    );
    expect(results.map(({ id }) => id)).not.toContain(legacyOnly.id);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.rel.nextCursor).toBeNull();
    expect(thirdPage.results).toEqual([]);
  });

  test("filters exact and generic target identity independently", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const { exact, generic } = await targetIds(
      bottle.id,
      bottle.groupId as number,
    );
    const { exact: otherExact } = await targetIds(
      otherBottle.id,
      otherBottle.groupId as number,
    );
    const exactTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: exact,
    });
    const genericTasting = await fixtures.Tasting({
      bottleId: null,
      releaseId: null,
      targetId: generic,
    });
    await fixtures.Tasting({
      bottleId: otherBottle.id,
      targetId: otherExact,
    });

    const [exactResults, genericResults] = await Promise.all([
      routerClient.tastings.list({ target: exact }),
      routerClient.tastings.list({ target: generic }),
    ]);

    expect(exactResults.results.map(({ id }) => id)).toEqual([exactTasting.id]);
    expect(genericResults.results.map(({ id }) => id)).toEqual([
      genericTasting.id,
    ]);
    expect(exactResults.results[0]?.target).toMatchObject({
      kind: "bottle",
      targetId: exact,
      bottle: { id: bottle.id },
    });
    expect(genericResults.results[0]?.target).toMatchObject({
      kind: "group",
      targetId: generic,
      group: { id: bottle.groupId },
    });
  });

  test("rejects mixed target and retained Bottle filters", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const { exact } = await targetIds(bottle.id, bottle.groupId as number);

    const [bottleError, releaseError] = await Promise.all([
      waitError(
        routerClient.tastings.list({
          target: exact,
          bottle: bottle.id,
        } as never),
      ),
      waitError(
        routerClient.tastings.list({
          target: exact,
          release: release.id,
        } as never),
      ),
    ]);

    for (const error of [bottleError, releaseError]) {
      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: "Input validation failed",
        data: {
          issues: [
            {
              code: "custom",
              message: "Target cannot be combined with retained Bottle input.",
              path: ["target"],
            },
          ],
        },
      });
    }
  });

  test("rejects an invalid direct target filter", async () => {
    const error = await waitError(
      routerClient.tastings.list({ target: 999_999 }),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Cannot identify catalog target.",
    });
  });

  test("lists tastings with release", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const { target } = await promoteRelease(bottle, release.id);
    const otherBottle = await fixtures.Bottle();
    const { exact: otherExact } = await targetIds(
      otherBottle.id,
      otherBottle.groupId as number,
    );
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: target.id,
    });
    const targetOnly = await fixtures.Tasting({
      bottleId: otherBottle.id,
      targetId: target.id,
    });
    const legacyOnly = await fixtures.Tasting({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: otherExact,
    });

    const { results } = await routerClient.tastings.list({
      release: release.id,
    });

    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([tasting.id, targetOnly.id]),
    );
    expect(results.map(({ id }) => id)).not.toContain(legacyOnly.id);
    expect(results.find(({ id }) => id === tasting.id)?.target).toMatchObject({
      kind: "bottle",
      targetId: target.id,
    });
  });

  test("preserves empty legacy-filter misses and surfaces graph failures", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });

    await expect(
      routerClient.tastings.list({ bottle: 999_999 }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      routerClient.tastings.list({ release: 999_999 }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      routerClient.tastings.list({
        bottle: otherBottle.id,
        release: release.id,
      }),
    ).resolves.toMatchObject({ results: [] });

    const error = await waitError(
      routerClient.tastings.list({ release: release.id }),
    );
    expect(error).toBeInstanceOf(CatalogTargetInvalidMappingError);
  });

  test("uses the generic target for bottle filters and group entity identity", async ({
    fixtures,
  }) => {
    const groupBrand = await fixtures.Entity();
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    await db
      .update(bottleGroups)
      .set({ brandId: groupBrand.id })
      .where(eq(bottleGroups.id, parent.groupId as number));
    const { generic } = await targetIds(parent.id, parent.groupId as number);
    const tasting = await fixtures.Tasting({
      bottleId: parent.id,
      releaseId: null,
      targetId: generic,
    });
    const legacyEntityBottle = await fixtures.Bottle({
      brandId: groupBrand.id,
    });
    const otherBottle = await fixtures.Bottle();
    const { exact: otherExact } = await targetIds(
      otherBottle.id,
      otherBottle.groupId as number,
    );
    const legacyOnly = await fixtures.Tasting({
      bottleId: legacyEntityBottle.id,
      targetId: otherExact,
    });

    const byBottle = await routerClient.tastings.list({ bottle: parent.id });
    const byEntity = await routerClient.tastings.list({
      entity: groupBrand.id,
    });

    expect(byBottle.results.map(({ id }) => id)).toContain(tasting.id);
    expect(byEntity.results.map(({ id }) => id)).toContain(tasting.id);
    expect(byEntity.results.map(({ id }) => id)).not.toContain(legacyOnly.id);
    expect(byBottle.results[0].target).toMatchObject({
      kind: "group",
      targetId: generic,
      group: { id: parent.groupId },
    });
  });

  test("renders the durable target when the retained pair disagrees", async ({
    fixtures,
  }) => {
    const retainedBottle = await fixtures.Bottle();
    const targetBottle = await fixtures.Bottle();
    const { exact } = await targetIds(
      targetBottle.id,
      targetBottle.groupId as number,
    );
    const tasting = await fixtures.Tasting({
      bottleId: retainedBottle.id,
      targetId: exact,
    });

    const { results } = await routerClient.tastings.list();
    const result = results.find(({ id }) => id === tasting.id)!;

    expect(result.target).toMatchObject({
      kind: "bottle",
      targetId: exact,
      bottle: { id: targetBottle.id },
    });
  });

  test("lists tastings with user", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });
    await fixtures.Tasting();

    const { results } = await routerClient.tastings.list({
      user: defaults.user.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });

  test("lists tastings filter friends unauthenticated", async ({
    fixtures,
  }) => {
    await fixtures.Tasting();
    await fixtures.Tasting();

    const err = await waitError(() =>
      routerClient.tastings.list({
        filter: "friends",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists tastings filter friends", async ({ defaults, fixtures }) => {
    await fixtures.Tasting();
    await fixtures.Tasting();

    const otherUser = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });
    const lastTasting = await fixtures.Tasting({ createdById: otherUser.id });

    const { results } = await routerClient.tastings.list(
      {
        filter: "friends",
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(lastTasting.id);
  });

  test("lists tastings hides private while authenticated", async ({
    defaults,
    fixtures,
  }) => {
    const friend = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
      status: "following",
    });

    // should hide tasting from non-friend
    await fixtures.Tasting({
      createdById: (await fixtures.User({ private: true })).id,
    });
    // should show tasting from friend
    const tasting = await fixtures.Tasting({ createdById: friend.id });

    const { results } = await routerClient.tastings.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });

  test("lists tastings hides private while anonymous", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();
    await fixtures.Tasting({
      createdById: (await fixtures.User({ private: true })).id,
    });

    const { results } = await routerClient.tastings.list();

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });
});
