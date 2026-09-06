import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottle-series/{series}/flavor-profile", () => {
  test("counts active Series Bottles once per family and excludes private notes", async ({
    fixtures,
    defaults,
  }) => {
    const series = await fixtures.BottleSeries();
    const first = await fixtures.Bottle({ seriesId: series.id });
    const second = await fixtures.Bottle({ seriesId: series.id });
    const unrelated = await fixtures.Bottle();
    const privateUser = await fixtures.User({ private: true });
    await fixtures.Tag({ name: "smoke", tagCategory: "smoke" });
    await fixtures.Tag({ name: "ash", tagCategory: "smoke" });
    await fixtures.Tag({ name: "vanilla", tagCategory: "sweet" });
    await db.insert(tastings).values([
      {
        bottleId: first.id,
        createdById: defaults.user.id,
        tags: ["smoke", "ash", "vanilla"],
        createdAt: new Date("2026-01-01"),
      },
      {
        bottleId: second.id,
        createdById: defaults.user.id,
        tags: ["smoke"],
      },
      {
        bottleId: unrelated.id,
        createdById: defaults.user.id,
        tags: ["vanilla"],
      },
      {
        bottleId: second.id,
        createdById: privateUser.id,
        tags: ["vanilla"],
      },
    ]);

    const result = await routerClient.bottleSeries.flavorProfile(
      { series: series.id },
      { context: { user: privateUser } },
    );

    expect(result.totalBottles).toBe(2);
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
  });

  test("returns an empty profile for a Series without Bottles", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries();
    const result = await routerClient.bottleSeries.flavorProfile({
      series: series.id,
    });

    expect(result.totalBottles).toBe(0);
    expect(result.notedBottles).toBe(0);
  });

  test("returns not found for a missing Series", async () => {
    await expect(
      routerClient.bottleSeries.flavorProfile({ series: 999_999_999 }),
    ).rejects.toThrow("Series not found.");
  });
});
