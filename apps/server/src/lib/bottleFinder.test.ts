import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import { findBottleAliasAssignment, findBottleId } from "./bottleFinder";

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

  test("returns a target- and release-free direct Bottle snapshot", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const evidenceBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: evidenceBottle.id,
    });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Direct Alias With Evidence",
    });

    const result = await findBottleAliasAssignment(alias.name);

    expect(result).toMatchObject({
      alias: {
        name: alias.name,
        bottleId: bottle.id,
        ignored: false,
        assignmentSource: alias.assignmentSource,
        assignedByActorId: alias.assignedByActorId,
      },
      bottleId: bottle.id,
    });
    expect(result?.alias).not.toHaveProperty("releaseId");
  });

  test("resolves a general alias to its retained Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "General Bottle Alias",
    });

    await expect(findBottleAliasAssignment(alias.name)).resolves.toMatchObject({
      alias: { bottleId: bottle.id },
      bottleId: bottle.id,
    });
  });

  test("excludes ignored aliases but preserves inactive direct assignments", async ({
    fixtures,
  }) => {
    const ignored = await fixtures.Bottle();
    const unassigned = await fixtures.LegacyBottle();
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.BottleAlias({
      name: "Ignored Alias",
      bottleId: ignored.id,
      ignored: true,
    });
    await fixtures.BottleAlias({
      name: "Unbound Alias",
      bottleId: null,
    });
    await fixtures.BottleAlias({
      name: "Unassigned Alias",
      bottleId: unassigned.id,
    });
    await fixtures.BottleAlias({
      name: "Retired Alias",
      bottleId: retired.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    await expect(findBottleId("Ignored Alias")).resolves.toBeNull();
    await expect(findBottleId("Unbound Alias")).resolves.toBeNull();
    await expect(findBottleId("Unassigned Alias")).resolves.toBe(unassigned.id);
    await expect(findBottleId("Retired Alias")).resolves.toBe(retired.id);
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
