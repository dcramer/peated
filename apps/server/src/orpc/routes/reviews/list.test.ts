import { db } from "@peated/server/db";
import {
  actors,
  bottleReleasePromotions,
  bottles,
  catalogTargets,
  type Bottle,
} from "@peated/server/db/schema";
import { CatalogTargetInvalidMappingError } from "@peated/server/lib/catalogTargets";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull, sql } from "drizzle-orm";

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

describe("GET /reviews", () => {
  test("lists reviews", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.Review({ externalSiteId: site.id });
    await fixtures.Review({ externalSiteId: site.id });

    const { results } = await routerClient.reviews.list(
      {},
      { context: { user } },
    );

    expect(results.length).toBe(2);
    const result = results.find(({ id }) => id === review.id)!;
    expect(result.target).toMatchObject({
      kind: "bottle",
      bottle: { id: review.bottleId },
    });
    expect(result).not.toHaveProperty("bottle");
    expect(result).not.toHaveProperty("release");
  });

  test("authenticated serialization does not mutate the user's Actor", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.Review({ externalSiteId: site.id });
    const currentUser = await fixtures.User({ mod: true });
    const sentinel = {
      active: false,
      displayName: "review read sentinel",
    } as const;
    await db
      .update(actors)
      .set(sentinel)
      .where(eq(actors.userId, currentUser.id));
    const [{ count: before }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);

    await routerClient.reviews.list({}, { context: { user: currentUser } });

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

  test("errors without mod", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.reviews.list({}, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all reviews.]`,
    );
  });

  test("lists reviews by site", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const astorwine = await fixtures.ExternalSiteOrExisting({
      type: "astorwines",
    });
    const totalwine = await fixtures.ExternalSiteOrExisting({
      type: "totalwine",
    });

    const review = await fixtures.Review({ externalSiteId: astorwine.id });
    await fixtures.Review({ externalSiteId: totalwine.id });

    const { results } = await routerClient.reviews.list(
      {
        site: astorwine.type,
      },
      { context: { user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(review.id);
  });

  test("lists reviews by authoritative exact or generic target", async ({
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle();
    const genericBottle = await fixtures.Bottle();
    const [exactTarget, genericTarget] = await Promise.all([
      db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, exactBottle.id),
      }),
      db.query.catalogTargets.findFirst({
        where: and(
          eq(catalogTargets.groupId, genericBottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
      }),
    ]);
    if (!exactTarget || !genericTarget) throw new Error("Missing targets");
    const site = await fixtures.ExternalSiteOrExisting();
    const exactReview = await fixtures.Review({
      externalSiteId: site.id,
      targetId: exactTarget.id,
      bottleId: exactBottle.id,
    });
    const genericReview = await fixtures.Review({
      externalSiteId: site.id,
      targetId: genericTarget.id,
      bottleId: null,
      releaseId: null,
    });

    const exact = await routerClient.reviews.list({ target: exactTarget.id });
    const generic = await routerClient.reviews.list({
      target: genericTarget.id,
    });

    expect(exact.results.map(({ id }) => id)).toEqual([exactReview.id]);
    expect(generic.results.map(({ id }) => id)).toEqual([genericReview.id]);
    expect(generic.results[0]?.target).toMatchObject({ kind: "group" });
  });

  test("rejects invalid and mixed target filters", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Missing target");

    await expect(
      waitError(() =>
        routerClient.reviews.list({ target: Number.MAX_SAFE_INTEGER }),
      ),
    ).resolves.toMatchObject({ message: "Cannot identify catalog target." });
    await expect(
      waitError(() =>
        routerClient.reviews.list({
          target: target.id,
          bottle: bottle.id,
        } as never),
      ),
    ).resolves.toMatchObject({ message: "Input validation failed" });
  });

  test("lists reviews by release", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const { promoted, target } = await promoteRelease(bottle, release.id);
    const otherBottle = await fixtures.Bottle();
    const otherTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    if (!otherTarget) throw new Error("Missing other target fixture");
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: target.id,
      externalSiteId: site.id,
    });
    const targetOnly = await fixtures.Review({
      bottleId: otherBottle.id,
      targetId: target.id,
      externalSiteId: site.id,
      issue: "Target only",
    });
    const legacyOnly = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: otherTarget.id,
      externalSiteId: site.id,
      issue: "Legacy only",
    });

    const firstPage = await routerClient.reviews.list({
      release: release.id,
      limit: 1,
    });
    const secondPage = await routerClient.reviews.list({
      release: release.id,
      cursor: 2,
      limit: 1,
    });
    const thirdPage = await routerClient.reviews.list({
      release: release.id,
      cursor: 3,
      limit: 1,
    });
    const results = [...firstPage.results, ...secondPage.results];

    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([review.id, targetOnly.id]),
    );
    expect(results.map(({ id }) => id)).not.toContain(legacyOnly.id);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.rel.nextCursor).toBeNull();
    expect(thirdPage.results).toEqual([]);
    expect(results.find(({ id }) => id === review.id)?.target).toMatchObject({
      kind: "bottle",
      targetId: target.id,
      bottle: { id: promoted.id },
    });
  });

  test("lists a parent-scoped review through its generic target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    const site = await fixtures.ExternalSiteOrExisting();
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(
          eq(table.groupId, parent.groupId as number),
          isNull(table.bottleId),
        ),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: null,
      targetId: genericTarget.id,
      externalSiteId: site.id,
    });

    const { results } = await routerClient.reviews.list({ bottle: parent.id });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: review.id,
      target: {
        kind: "group",
        targetId: genericTarget.id,
        group: { id: parent.groupId },
      },
    });
  });

  test("preserves empty legacy-filter misses and surfaces graph failures", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });

    await expect(
      routerClient.reviews.list({ bottle: 999_999 }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      routerClient.reviews.list({ release: 999_999 }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      routerClient.reviews.list({
        bottle: otherBottle.id,
        release: release.id,
      }),
    ).resolves.toMatchObject({ results: [] });

    const error = await waitError(
      routerClient.reviews.list({ release: release.id }),
    );
    expect(error).toBeInstanceOf(CatalogTargetInvalidMappingError);
  });

  test("uses target identity for unknown and retained-pair mismatch reads", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const unresolved = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      externalSiteId: site.id,
    });
    const retainedBottle = await fixtures.Bottle();
    const targetBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, targetBottle.id),
    });
    if (!target) throw new Error("Missing exact target fixture");
    const mismatched = await fixtures.Review({
      bottleId: retainedBottle.id,
      targetId: target.id,
      externalSiteId: site.id,
      issue: "Mismatch",
    });
    const targetOnlyUnknown = await fixtures.Review({
      bottleId: retainedBottle.id,
      targetId: null,
      externalSiteId: site.id,
      issue: "Target unknown only",
    });
    const legacyOnlyUnknown = await fixtures.Review({
      bottleId: null,
      targetId: target.id,
      externalSiteId: site.id,
      issue: "Legacy unknown only",
    });

    const unknownResults = await routerClient.reviews.list(
      { onlyUnknown: true },
      { context: { user } },
    );
    const allResults = await routerClient.reviews.list(
      {},
      { context: { user } },
    );

    expect(unknownResults.results.map(({ id }) => id)).toContain(unresolved.id);
    expect(unknownResults.results.map(({ id }) => id)).toContain(
      targetOnlyUnknown.id,
    );
    expect(
      unknownResults.results.find(({ id }) => id === targetOnlyUnknown.id)
        ?.target,
    ).toBeNull();
    expect(unknownResults.results.map(({ id }) => id)).not.toContain(
      mismatched.id,
    );
    expect(unknownResults.results.map(({ id }) => id)).not.toContain(
      legacyOnlyUnknown.id,
    );
    expect(
      allResults.results.find(({ id }) => id === mismatched.id)?.target,
    ).toMatchObject({
      kind: "bottle",
      targetId: target.id,
      bottle: { id: targetBottle.id },
    });
  });

  test("errors on unknown release reviews without mod", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });

    const err = await waitError(
      routerClient.reviews.list({
        release: release.id,
        onlyUnknown: true,
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all reviews.]`,
    );
  });

  test("errors on site without mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const site = await fixtures.ExternalSiteOrExisting();

    const err = await waitError(
      routerClient.reviews.list(
        {
          site: site.type,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all reviews.]`,
    );
  });
});
