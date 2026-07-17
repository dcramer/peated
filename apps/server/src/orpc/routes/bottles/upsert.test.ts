import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleGroups, bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PUT /bottles", () => {
  beforeEach(() => {
    config.OPENAI_API_KEY = undefined;
  });

  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottles.upsert({
        name: "Delicious Wood",
        brand: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects unsupported image input at the upsert boundary", async ({
    fixtures,
  }) => {
    const modUser = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();
    const input = {
      name: "Unsupported Image Input",
      brand: brand.id,
      imageUrl: "https://example.com/bottle.jpg",
    } as Parameters<typeof routerClient.bottles.upsert>[0];

    const err = await waitError(
      routerClient.bottles.upsert(input, { context: { user: modUser } }),
    );

    expect(err.message).toBe("Input validation failed");
    expect(await db.select().from(bottles)).toHaveLength(0);
  });

  test("creates a new bottle", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();

    const data = await routerClient.bottles.upsert(
      {
        name: "Delicious Wood",
        brand: brand.id,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.id));
    expect(bottle.name).toEqual("Delicious Wood");
  });

  test("returns existing bottle when identical", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: brand.id,
    });

    const data = await routerClient.bottles.upsert(
      {
        name: "Delicious Wood",
        brand: brand.id,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();
    expect(data.id).toEqual(bottle.id);
  });

  test("translates a conflicting flat update through the concrete Bottle path", async ({
    fixtures,
  }) => {
    const modUser = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();
    const selected = await fixtures.Bottle({
      name: "Compatibility Wood",
      brandId: brand.id,
      edition: "Batch 1",
      description: "Selected description before update.",
    });
    const siblingTarget = await routerClient.bottles.createFromSource(
      {
        bottle: selected.id,
        edition: "Batch 2",
        description: "Sibling description stays exact.",
      },
      { context: { user: modUser } },
    );

    const data = await routerClient.bottles.upsert(
      {
        name: "Compatibility Wood",
        brand: brand.id,
        category: "single_malt",
        edition: "Batch 1",
        description: "Selected description after update.",
      },
      { context: { user: modUser } },
    );

    const [persistedSelected] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, selected.id));
    const [persistedSibling] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, siblingTarget.bottle.id));
    const [persistedGroup] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, selected.groupId!));

    expect(persistedGroup).toMatchObject({
      category: "single_malt",
      description: null,
    });
    expect(persistedSelected).toMatchObject({
      groupId: persistedGroup.id,
      category: "single_malt",
      edition: "Batch 1",
      description: "Selected description after update.",
    });
    expect(persistedSibling).toMatchObject({
      groupId: persistedGroup.id,
      category: "single_malt",
      edition: "Batch 2",
      description: "Sibling description stays exact.",
    });
    expect(data).toMatchObject({
      id: selected.id,
      category: "single_malt",
      edition: "Batch 1",
      description: "Selected description after update.",
      brand: { id: brand.id },
    });
    expect(data).not.toHaveProperty("bottle");
    expect(data).not.toHaveProperty("targetId");
  });
});
