import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /bottles/:bottle/tags", () => {
  test("lists tags", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "A",
    });
    const bottle2 = await fixtures.Bottle({
      name: "B",
      brandId: bottle.brandId,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["solvent", "caramel"],
      rating: 5,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["caramel"],
      rating: 5,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      tags: ["cedar", "caramel"],
      rating: 5,
    });

    const { results, totalCount } = await routerClient.bottles.tags({
      bottle: bottle.id,
    });

    expect(totalCount).toEqual(2);
    expect(results).toEqual([
      { tag: "caramel", count: 2 },
      { tag: "solvent", count: 1 },
    ]);
  });

  test("counts only tagged Tastings with the selected Bottle exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const otherBottle = await fixtures.Bottle({ name: "Other Bottle" });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const otherTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    if (!target || !otherTarget) throw new Error("Missing target fixture");

    await fixtures.Tasting({
      bottleId: otherBottle.id,
      targetId: target.id,
      tags: ["authoritative"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      tags: ["retained-drift"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      tags: ["targetless"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: target.id,
      tags: [],
    });

    const result = await routerClient.bottles.tags({ bottle: bottle.id });

    expect(result.totalCount).toBe(1);
  });

  test("counts a promoted release by its exact target despite retained parent identity", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Promotion Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        name: "Promoted Bottle",
        fullName: "Promoted Bottle",
        createdByActorId: parent.createdByActorId,
      })
      .returning();
    if (!promotedBottle) throw new Error("Missing promoted Bottle fixture");
    const [promotedTarget] = await db
      .insert(catalogTargets)
      .values({
        groupId: parent.groupId as number,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!promotedTarget) throw new Error("Missing promoted target fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    await fixtures.Tasting({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: promotedTarget.id,
      tags: ["promoted"],
    });
    await fixtures.Tasting({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      tags: ["targetless"],
    });

    const result = await routerClient.bottles.tags({
      bottle: promotedBottle.id,
    });

    expect(result.totalCount).toBe(1);
  });

  test("fails closed when a relevant Tasting has a retired durable target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const retiredBottle = await fixtures.Bottle({ name: "Retired Bottle" });
    const replacement = await fixtures.Bottle({ name: "Replacement Bottle" });
    const retiredTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, retiredBottle.id),
    });
    if (!retiredTarget) throw new Error("Missing target fixture");
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: retiredTarget.id,
      tags: ["invalid"],
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.bottles.tags({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("fails closed when the selected Bottle has no exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();

    const error = await waitError(
      routerClient.bottles.tags({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("preserves missing Bottle behavior", async () => {
    await expect(
      routerClient.bottles.tags({ bottle: 999_999_999 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
