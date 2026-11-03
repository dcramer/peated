import { db } from "@peated/server/db";
import { bottleGroups, bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

async function getBottle(id: number) {
  const [bottle] = await db.select().from(bottles).where(eq(bottles.id, id));
  return bottle;
}

async function getGroup(id: number) {
  const [group] = await db
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, id));
  return group;
}

describe("POST /bottles/:bottle/group", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottles.moveToGroup(
        { bottle: 1, group: 2 },
        { context: { user: null } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false, admin: false });
    const err = await waitError(
      routerClient.bottles.moveToGroup(
        { bottle: 1, group: 2 },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("moves a yearly release into the expression's group", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Stagg", type: ["brand"] });
    const target = await fixtures.Bottle({
      brandId: brand.id,
      name: "Kentucky Straight Bourbon",
      statedAge: 15,
      releaseYear: 2022,
      abv: 69.35,
    });
    const moving = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bourbon - 2023 Release",
      statedAge: 16,
      releaseYear: 2023,
      abv: 67.5,
    });
    const mod = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.moveToGroup(
      { bottle: moving.id, group: target.groupId },
      { context: { user: mod } },
    );

    expect(data.fullName).toBe("Stagg Kentucky Straight Bourbon");
    const moved = await getBottle(moving.id);
    expect(moved).toMatchObject({
      groupId: target.groupId,
      name: "Kentucky Straight Bourbon",
      fullName: "Stagg Kentucky Straight Bourbon",
      statedAge: 16,
      releaseYear: 2023,
      abv: 67.5,
    });
    expect(await getBottle(target.id)).toMatchObject({ statedAge: 15 });
    expect(await getGroup(moving.groupId)).toBeUndefined();
    expect(await getGroup(target.groupId)).toMatchObject({ totalBottles: 2 });
  });

  test("keeps the old group when other Bottles remain", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ type: ["brand"] });
    const target = await fixtures.Bottle({ brandId: brand.id, name: "Target" });
    const moving = await fixtures.Bottle({
      brandId: brand.id,
      name: "Source",
      releaseYear: 2020,
    });
    const staying = await fixtures.BottleGroupMember({
      groupId: moving.groupId,
      releaseYear: 2021,
    });
    const mod = await fixtures.User({ mod: true });

    await routerClient.bottles.moveToGroup(
      { bottle: moving.id, group: target.groupId },
      { context: { user: mod } },
    );

    expect(await getGroup(moving.groupId)).toMatchObject({
      representativeBottleId: staying.id,
      totalBottles: 1,
    });
    expect(await getBottle(staying.id)).toMatchObject({
      groupId: moving.groupId,
      fullName: staying.fullName,
    });
  });

  test("rejects a Bottle with a different brand", async ({ fixtures }) => {
    const target = await fixtures.Bottle({ name: "Target" });
    const moving = await fixtures.Bottle({ name: "Other" });
    const mod = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.moveToGroup(
        { bottle: moving.id, group: target.groupId },
        { context: { user: mod } },
      ),
    );
    expect(err.message).toBe(
      `Bottle ${moving.id} has a different brand from BottleGroup ${target.groupId}. Edit the Bottle to match first.`,
    );
    expect(await getBottle(moving.id)).toMatchObject({
      groupId: moving.groupId,
    });
  });

  test("rejects a Bottle that would take the group's age", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ type: ["brand"] });
    const target = await fixtures.Bottle({
      brandId: brand.id,
      name: "17-year-old",
      statedAge: 17,
    });
    const moving = await fixtures.Bottle({
      brandId: brand.id,
      name: "Seventeen",
      statedAge: null,
    });
    const mod = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.moveToGroup(
        { bottle: moving.id, group: target.groupId },
        { context: { user: mod } },
      ),
    );
    expect(err.message).toBe(
      `Bottle ${moving.id} has no age, but BottleGroup ${target.groupId} shares the age 17. Clear the group age or set the Bottle's age first.`,
    );
  });

  test("rejects a Bottle that duplicates a group member", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ type: ["brand"] });
    const target = await fixtures.Bottle({
      brandId: brand.id,
      name: "Target",
      releaseYear: 2024,
    });
    const moving = await fixtures.Bottle({
      brandId: brand.id,
      name: "Duplicate",
      releaseYear: 2024,
    });
    const mod = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.moveToGroup(
        { bottle: moving.id, group: target.groupId },
        { context: { user: mod } },
      ),
    );
    expect(err.message).toBe(
      `Bottle ${target.id} already has this identity. Merge the two Bottles instead.`,
    );
  });

  test("returns not found for an unknown group", async ({ fixtures }) => {
    const moving = await fixtures.Bottle();
    const mod = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.moveToGroup(
        { bottle: moving.id, group: 999_999_999 },
        { context: { user: mod } },
      ),
    );
    expect(err.message).toBe("BottleGroup 999999999 not found.");
  });
});
