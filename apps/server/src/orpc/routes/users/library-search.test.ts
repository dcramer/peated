import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/library/search", () => {
  test("suggests Library Entities by the start of their name, then Bottles", async ({
    defaults,
    fixtures,
  }) => {
    const laphroaig = await fixtures.Entity({
      name: "Laphroaig",
      kind: "distillery",
    });
    const bottler = await fixtures.Entity({
      name: "Signatory",
      kind: "bottler",
    });
    const ownBottle = await fixtures.Bottle({
      brandId: laphroaig.id,
      distillerIds: [laphroaig.id],
      name: "10",
    });
    // Named brands: a random fixture brand can contain "Laphroaig" and match.
    const independent = await fixtures.Bottle({
      brandId: bottler.id,
      bottlerId: bottler.id,
      distillerIds: [laphroaig.id],
      name: "Laphroaig 1998",
    });
    const ardbeg = await fixtures.Entity({ name: "Ardbeg", kind: "brand" });
    const unrelated = await fixtures.Bottle({
      brandId: ardbeg.id,
      name: "Uigeadail",
    });
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values(
      [ownBottle, independent, unrelated].map((bottle) => ({
        collectionId: library.id,
        bottleId: bottle.id,
      })),
    );

    const response = await routerClient.users.librarySearch(
      { user: "me", query: "laph" },
      { context: { user: defaults.user } },
    );

    expect(
      response.entities.map(({ entity, count }) => [entity.id, count]),
    ).toEqual([[laphroaig.id, 2]]);
    expect(response.bottles.map((bottle) => bottle.id)).toEqual(
      expect.arrayContaining([ownBottle.id, independent.id]),
    );
    expect(response.bottles).toHaveLength(2);
  });

  test("suggests a bottler from the member's Library", async ({
    defaults,
    fixtures,
  }) => {
    const bottler = await fixtures.Entity({
      name: "Gordon & MacPhail",
      kind: "bottler",
    });
    const bottle = await fixtures.Bottle({ bottlerId: bottler.id });
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    await db
      .insert(collectionBottles)
      .values({ collectionId: library.id, bottleId: bottle.id });

    const response = await routerClient.users.librarySearch(
      { user: "me", query: "gord" },
      { context: { user: defaults.user } },
    );

    expect(response.entities.map(({ entity }) => entity.id)).toEqual([
      bottler.id,
    ]);
  });

  test("does not suggest Entities or Bottles outside the member's Library", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Laphroaig" });
    const bottle = await fixtures.Bottle({ brandId: brand.id });
    const otherUser = await fixtures.User();
    const otherLibrary = await fixtures.Collection({
      name: "Library",
      createdById: otherUser.id,
    });
    await db
      .insert(collectionBottles)
      .values({ collectionId: otherLibrary.id, bottleId: bottle.id });
    await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    const response = await routerClient.users.librarySearch(
      { user: "me", query: "laph" },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({ entities: [], bottles: [] });
  });

  test("returns nothing for empty search text", async ({ defaults }) => {
    const response = await routerClient.users.librarySearch(
      { user: "me", query: "  " },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({ entities: [], bottles: [] });
  });

  test("rejects a private profile without friendship", async ({
    defaults,
    fixtures,
  }) => {
    const user = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.users.librarySearch(
        { user: user.id, query: "laph" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
