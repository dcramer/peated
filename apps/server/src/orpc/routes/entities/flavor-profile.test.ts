import { db } from "@peated/server/db";
import { bottleTombstones, tastings } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/{entity}/flavor-profile", () => {
  test("counts bottles once per family, excludes private notes, and shows coverage", async ({
    fixtures,
    defaults,
  }) => {
    const distillery = await fixtures.Entity({ kind: "distillery" });
    const first = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const second = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const empty = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const unknown = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const privateOnly = await fixtures.Bottle({
      distillerIds: [distillery.id],
    });
    const privateUser = await fixtures.User({ private: true });
    for (const [name, tagCategory] of [
      ["smoke", "smoke"],
      ["ash", "smoke"],
      ["brine", "smoke"],
      ["vanilla", "sweet"],
      ["iodine", "smoke"],
    ] as const) {
      await fixtures.Tag({ name, tagCategory });
    }
    await db.insert(tastings).values([
      {
        bottleId: first.id,
        createdById: defaults.user.id,
        tags: ["smoke", "ash", "brine", "vanilla", "smoke"],
        createdAt: new Date("2026-01-01"),
      },
      {
        bottleId: first.id,
        createdById: defaults.user.id,
        tags: ["smoke", "ash"],
        createdAt: new Date("2026-01-02"),
      },
      { bottleId: second.id, createdById: defaults.user.id, tags: ["smoke"] },
      { bottleId: first.id, createdById: privateUser.id, tags: ["iodine"] },
      {
        bottleId: privateOnly.id,
        createdById: privateUser.id,
        tags: ["iodine"],
      },
      { bottleId: empty.id, createdById: defaults.user.id, tags: [] },
      {
        bottleId: unknown.id,
        createdById: defaults.user.id,
        tags: ["unclassified-note"],
      },
    ]);

    const result = await routerClient.entities.flavorProfile(
      { entity: distillery.id },
      { context: { user: privateUser } },
    );
    expect(result.totalBottles).toBe(5);
    expect(result.notedBottles).toBe(2);
    expect(result.categories.find((item) => item.category === "smoke")).toEqual(
      {
        category: "smoke",
        bottleCount: 2,
        notes: [
          { name: "smoke", bottleCount: 2 },
          { name: "ash", bottleCount: 1 },
        ],
      },
    );
    expect(result.categories.find((item) => item.category === "sweet")).toEqual(
      {
        category: "sweet",
        bottleCount: 1,
        notes: [{ name: "vanilla", bottleCount: 1 }],
      },
    );
    expect(result.categories.find((item) => item.category === "wood")).toEqual({
      category: "wood",
      bottleCount: 0,
      notes: [],
    });
    expect(result.categories).toHaveLength(9);
  });

  test("includes only active bottles produced by the selected distillery", async ({
    fixtures,
    defaults,
  }) => {
    const distillery = await fixtures.Entity({ kind: "distillery" });
    const active = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const removed = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const legacy = await fixtures.LegacyBottle({
      distillerIds: [distillery.id],
    });
    const brandOnly = await fixtures.Bottle({
      brandId: distillery.id,
      distillerIds: [],
    });
    const bottlerOnly = await fixtures.Bottle({
      bottlerId: distillery.id,
      distillerIds: [],
    });
    await db
      .insert(bottleTombstones)
      .values({ bottleId: removed.id, newBottleId: active.id });
    await fixtures.Tag({ name: "smoke", tagCategory: "smoke" });
    await db.insert(tastings).values(
      [active, removed, legacy, brandOnly, bottlerOnly].map((bottle) => ({
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["smoke"],
      })),
    );

    const result = await routerClient.entities.flavorProfile({
      entity: distillery.id,
    });
    expect(result.totalBottles).toBe(1);
    expect(result.notedBottles).toBe(1);
    expect(
      result.categories.find((item) => item.category === "smoke")?.bottleCount,
    ).toBe(1);
  });

  test("returns an empty profile for a distillery without bottles", async ({
    fixtures,
  }) => {
    const distillery = await fixtures.Entity({ kind: "distillery" });
    const result = await routerClient.entities.flavorProfile({
      entity: distillery.id,
    });
    expect(result.totalBottles).toBe(0);
    expect(result.notedBottles).toBe(0);
    expect(
      result.categories.every(
        (item) => item.bottleCount === 0 && item.notes.length === 0,
      ),
    ).toBe(true);
  });

  test("rejects a missing entity or a non-distillery", async ({ fixtures }) => {
    await expect(
      routerClient.entities.flavorProfile({ entity: 99999 }),
    ).rejects.toThrow("Entity not found.");
    const brand = await fixtures.Entity({ kind: "brand" });
    await expect(
      routerClient.entities.flavorProfile({ entity: brand.id }),
    ).rejects.toThrow("Choose a distillery");
  });
});
