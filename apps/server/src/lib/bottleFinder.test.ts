import { db } from "@peated/server/db";
import { bottleAliases, catalogTargets } from "@peated/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { findBottleId, findBottleTarget } from "./bottleFinder";

const compatibilityContext = {
  caller: "bottleFinder.test",
  operation: "resolveAlias",
};

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
    const result = await findBottleId(bottle.fullName, compatibilityContext);
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
    const result = await findBottleId(
      "The Macallan 12-year-old",
      compatibilityContext,
    );
    expect(result).toMatchInlineSnapshot(`null`);
  });

  test("doesnt match random junk", async ({ fixtures }) => {
    await fixtures.Bottle();
    const result = await findBottleId("No Chance", compatibilityContext);
    expect(result).toMatchInlineSnapshot(`null`);
  });

  test("matches alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Something Silly",
    });
    const result = await findBottleId("Something Silly", compatibilityContext);
    expect(result).toMatchInlineSnapshot(`1`);
  });

  test("resolves a target-backed exact alias directly through its target", async ({
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
      findBottleTarget("Target-backed Exact Alias", compatibilityContext),
    ).resolves.toEqual({
      bottleId: bottle.id,
      releaseId: null,
      targetId,
    });
  });

  test("does not resolve a generic alias through its legacy Bottle", async ({
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
      findBottleTarget("Generic Alias", compatibilityContext),
    ).resolves.toBeNull();
  });

  test("falls back to the legacy pair only when targetId is null", async ({
    fixtures,
  }) => {
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
      findBottleTarget("Legacy Release Alias", compatibilityContext),
    ).resolves.toEqual({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
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
    const result = await findBottleId(
      "Aberfeldy 18-year-old Port Cask",
      compatibilityContext,
    );
    expect(result).toMatchInlineSnapshot(`2`);

    const result2 = await findBottleId(
      "Aberfeldy 18-year-old",
      compatibilityContext,
    );
    expect(result2).toMatchInlineSnapshot(`1`);
  });
});
