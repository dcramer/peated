import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/collections/:collection/bottles", () => {
  test("rejects a private profile without friendship", async ({
    defaults,
    fixtures,
  }) => {
    const user = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.collections.bottles.list(
        { user: user.id, collection: "default" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });

  test("returns independently complete Bottles in stable name order", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Ordering Brand" });
    const later = await fixtures.Bottle({
      brandId: brand.id,
      name: "Zulu",
    });
    const first = await fixtures.Bottle({
      brandId: brand.id,
      name: "Alpha",
    });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    await db.insert(collectionBottles).values([
      { collectionId: collection.id, bottleId: later.id },
      { collectionId: collection.id, bottleId: first.id },
    ]);

    const response = await routerClient.collections.bottles.list(
      { user: "me", collection: collection.id },
      { context: { user: defaults.user } },
    );

    expect(response.results.map(({ bottle }) => bottle.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(response.results[0]?.bottle).toMatchObject({
      id: first.id,
      fullName: first.fullName,
      group: {
        id: first.groupId,
      },
    });
    expect(response.results[0]).not.toHaveProperty("target");
  });

  test("filters direct membership by Bottle id", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const other = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    await db.insert(collectionBottles).values([
      { collectionId: collection.id, bottleId: selected.id },
      { collectionId: collection.id, bottleId: other.id },
    ]);

    const response = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        bottle: selected.id,
      },
      { context: { user: defaults.user } },
    );

    expect(response.results.map(({ bottle }) => bottle.id)).toEqual([
      selected.id,
    ]);
  });

  test("rejects the removed target filter", async ({ defaults, fixtures }) => {
    type Input = Parameters<typeof routerClient.collections.bottles.list>[0];

    const error = await waitError(() =>
      routerClient.collections.bottles.list(
        {
          user: "me",
          collection: "library",
          target: 1,
        } as unknown as Input,
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
  });
});
