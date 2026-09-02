import { db } from "@peated/server/db";
import { bottleTombstones, tastings } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /tags/bottles", () => {
  test("ranks by prevalence, counts each tasting once, and excludes untagged tastings", async ({
    fixtures,
  }) => {
    await fixtures.Tag({ name: "smoke", tagCategory: "smoke" });
    await fixtures.Tag({ name: "peat", tagCategory: "smoke" });
    await fixtures.Tag({ name: "honey", tagCategory: "sweet" });
    const user = await fixtures.User();
    const frequent = await fixtures.Bottle();
    const consistent = await fixtures.Bottle();
    const smallSample = await fixtures.Bottle();
    const unrelated = await fixtures.Bottle();
    const rows = [
      ...Array.from({ length: 4 }, (_, index) => ({
        bottleId: frequent.id,
        tags: index < 3 ? ["smoke"] : ["honey"],
      })),
      { bottleId: consistent.id, tags: ["smoke", "peat"] },
      { bottleId: consistent.id, tags: ["peat"] },
      { bottleId: consistent.id, tags: [] },
      { bottleId: smallSample.id, tags: ["smoke"] },
      { bottleId: unrelated.id, tags: ["honey"] },
    ];
    await db.insert(tastings).values(
      rows.map((row, index) => ({
        ...row,
        createdById: user.id,
        createdAt: new Date(2026, 0, 1, 0, 0, index),
      })),
    );
    const { results } = await routerClient.tags.bottles({
      category: "smoke",
      limit: 3,
    });
    expect(
      results.map((result) => [
        result.bottle.id,
        result.matchingTastings,
        result.taggedTastings,
      ]),
    ).toEqual([
      [consistent.id, 2, 2],
      [smallSample.id, 1, 1],
      [frequent.id, 3, 4],
    ]);
    const note = await routerClient.tags.bottles({
      category: "smoke",
      note: "smoke",
    });
    expect(
      note.results.find((result) => result.bottle.id === consistent.id)
        ?.matchingTastings,
    ).toBe(1);
    expect(
      (await routerClient.tags.bottles({ category: "smoke", limit: 1 }))
        .results,
    ).toHaveLength(1);
  });

  test("resolves synonyms within the selected category and omits merged bottles", async ({
    fixtures,
  }) => {
    await fixtures.Tag({
      name: "smoke",
      synonyms: ["smoky"],
      tagCategory: "smoke",
    });
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const merged = await fixtures.Bottle();
    await db.insert(tastings).values([
      { bottleId: bottle.id, tags: ["smoky"], createdById: user.id },
      { bottleId: merged.id, tags: ["smoke"], createdById: user.id },
    ]);
    await db
      .insert(bottleTombstones)
      .values({ bottleId: merged.id, newBottleId: bottle.id });
    const result = await routerClient.tags.bottles({
      category: "smoke",
      note: " SMOKY ",
    });
    expect(result.results.map((result) => result.bottle.id)).toEqual([
      bottle.id,
    ]);
    expect(
      (await routerClient.tags.bottles({ category: "sweet", note: "smoke" }))
        .results,
    ).toEqual([]);
    expect(
      (await routerClient.tags.bottles({ category: "smoke", note: "unknown" }))
        .results,
    ).toEqual([]);
    expect(
      (await routerClient.tags.bottles({ category: "cereal" })).results,
    ).toEqual([]);
  });

  test("excludes private tastings from examples and prevalence, even for their author", async ({
    fixtures,
  }) => {
    await fixtures.Tag({ name: "smoke", tagCategory: "smoke" });
    await fixtures.Tag({ name: "honey", tagCategory: "sweet" });
    const publicUser = await fixtures.User();
    const privateUser = await fixtures.User({ private: true });
    const publicBottle = await fixtures.Bottle();
    const privateBottle = await fixtures.Bottle();
    await db.insert(tastings).values([
      {
        bottleId: publicBottle.id,
        tags: ["smoke"],
        createdById: publicUser.id,
      },
      {
        bottleId: publicBottle.id,
        tags: ["honey"],
        createdById: privateUser.id,
      },
      {
        bottleId: privateBottle.id,
        tags: ["smoke"],
        createdById: privateUser.id,
      },
    ]);
    const { results } = await routerClient.tags.bottles(
      { category: "smoke" },
      { context: { user: privateUser } },
    );
    expect(
      results.map(({ bottle, matchingTastings, taggedTastings }) => [
        bottle.id,
        matchingTastings,
        taggedTastings,
      ]),
    ).toEqual([[publicBottle.id, 1, 1]]);
  });

  test("rejects invalid categories and limits", async () => {
    await expect(
      routerClient.tags.bottles({ category: "smoke", limit: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      routerClient.tags.bottles({ category: "smoke", limit: 13 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      routerClient.tags.bottles({ category: "smoke", note: " " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
