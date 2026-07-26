import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleasePromotions,
  catalogTargets,
} from "@peated/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { findBottleAliasAssignment, findBottleId } from "./bottleFinder";

async function getExactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Exact target fixture not found.");
  return target.id;
}

describe("findBottleId", () => {
  test("matches exact", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "Test",
      vintageYear: null,
      releaseYear: null,
    });
    const result = await findBottleId(bottle.fullName);
    expect(result).toMatchInlineSnapshot(`1`);
  });

  // test("matches fullName as prefix", async ({ fixtures }) => {
  //   const bottle = await fixtures.Bottle();
  //   const result = await findBottleId(bottle.fullName + " Single Grain");
  //   expect(result).toBe(bottle.id);
  // });

  test("will not wrongly match a suffix", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "The Macallan" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "12-year-old Double Cask",
    });
    const result = await findBottleId("The Macallan 12-year-old");
    expect(result).toMatchInlineSnapshot(`null`);
  });

  test("doesnt match random junk", async ({ fixtures }) => {
    await fixtures.Bottle();
    const result = await findBottleId("No Chance");
    expect(result).toMatchInlineSnapshot(`null`);
  });

  test("matches alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Something Silly",
    });
    const result = await findBottleId("Something Silly");
    expect(result).toMatchInlineSnapshot(`1`);
  });

  test("uses the alias Bottle instead of retained exact-target drift", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const staleBottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    await fixtures.BottleAlias({
      bottleId: staleBottle.id,
      targetId,
      name: "Target-backed Exact Alias",
    });

    await expect(
      findBottleAliasAssignment("Target-backed Exact Alias"),
    ).resolves.toMatchObject({
      alias: {
        bottleId: staleBottle.id,
        targetId,
      },
      bottleId: staleBottle.id,
    });
  });

  test("resolves a general alias to its retained Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId!),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture not found.");
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: genericTarget.id,
      name: "Generic Alias",
    });

    await expect(
      findBottleAliasAssignment("Generic Alias"),
    ).resolves.toMatchObject({
      alias: {
        bottleId: bottle.id,
        targetId: genericTarget.id,
      },
      bottleId: bottle.id,
    });
  });

  test("projects a legacy alias as one direct Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    await db.insert(bottleAliases).values({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
      name: "Legacy Release Alias",
      assignedByActorId: bottle.createdByActorId,
    });

    await expect(
      findBottleAliasAssignment("Legacy Release Alias"),
    ).resolves.toMatchObject({
      alias: {
        bottleId: bottle.id,
        releaseId: release.id,
        targetId: null,
      },
      bottleId: bottle.id,
    });
  });

  test("retained release promotion evidence cannot override the alias Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.Bottle();
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    await db.insert(bottleAliases).values({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Promoted Direct Alias",
      assignedByActorId: parent.createdByActorId,
    });

    await expect(
      findBottleAliasAssignment("Promoted Direct Alias"),
    ).resolves.toMatchObject({
      alias: {
        bottleId: parent.id,
        releaseId: release.id,
        targetId: null,
      },
      bottleId: parent.id,
    });
  });

  test("prioritizes correct prefix", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ name: "Aberfeldy" });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      name: "18-year-old",
    });
    const bottle2 = await fixtures.Bottle({
      brandId: entity.id,
      name: "18-year-old Port Cask",
    });
    const result = await findBottleId("Aberfeldy 18-year-old Port Cask");
    expect(result).toMatchInlineSnapshot(`2`);

    const result2 = await findBottleId("Aberfeldy 18-year-old");
    expect(result2).toMatchInlineSnapshot(`1`);
  });
});
