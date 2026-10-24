import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient, type Inputs } from "@peated/server/orpc/router";
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

  test("paginates recently added Library entries by membership date with stable ties", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const brand = await fixtures.Entity({ name: "Ordering Brand" });
    const first = await fixtures.Bottle({ brandId: brand.id, name: "Zulu" });
    const second = await fixtures.Bottle({ brandId: brand.id, name: "Beta" });
    const oldest = await fixtures.Bottle({ brandId: brand.id, name: "Alpha" });
    const excluded = await fixtures.Bottle({ brandId: brand.id });
    const entries = await db
      .insert(collectionBottles)
      .values([
        {
          collectionId: collection.id,
          bottleId: first.id,
          status: "sealed",
          createdAt: new Date("2026-08-02T12:00:00Z"),
        },
        {
          collectionId: collection.id,
          bottleId: second.id,
          status: "sealed",
          createdAt: new Date("2026-08-02T12:00:00Z"),
        },
        {
          collectionId: collection.id,
          bottleId: oldest.id,
          status: "sealed",
          createdAt: new Date("2026-08-01T12:00:00Z"),
        },
        {
          collectionId: collection.id,
          bottleId: excluded.id,
          status: "open",
          createdAt: new Date("2026-08-03T12:00:00Z"),
        },
      ])
      .returning();

    const input = {
      user: "me",
      collection: "library",
      sort: "-created",
      status: "sealed",
      limit: 1,
    } as const;
    const context = { user: defaults.user };
    const firstPage = await routerClient.collections.bottles.list(input, {
      context,
    });
    const secondPage = await routerClient.collections.bottles.list(
      { ...input, cursor: firstPage.rel.nextCursor! },
      { context },
    );
    const lastPage = await routerClient.collections.bottles.list(
      { ...input, cursor: secondPage.rel.nextCursor! },
      { context },
    );

    expect(
      [firstPage, secondPage, lastPage].flatMap((page) =>
        page.results.map(({ id }) => id),
      ),
    ).toEqual([entries[1]!.id, entries[0]!.id, entries[2]!.id]);
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(lastPage.rel).toEqual({ nextCursor: null, prevCursor: 2 });
    // The total counts every filtered entry, not just this page.
    expect([firstPage, secondPage, lastPage].map((page) => page.total)).toEqual(
      [3, 3, 3],
    );
    const pastLastPage = await routerClient.collections.bottles.list(
      { ...input, cursor: 5 },
      { context },
    );
    expect(pastLastPage).toMatchObject({ results: [], total: 3 });
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

  test("returns legacy ungrouped Bottles from Library", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle({
      name: "Legacy Library Bottle",
    });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });

    const response = await routerClient.collections.bottles.list(
      { user: "me", collection: "library" },
      { context: { user: defaults.user } },
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.bottle).toMatchObject({
      id: bottle.id,
      fullName: bottle.fullName,
    });
    expect(response.results[0]?.bottle).not.toHaveProperty("group");
  });

  test("does not match an ignored Bottle reference in Library", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Visible Canonical Name" });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });
    await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Hidden Library Alias",
      ignored: true,
    });

    const response = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        query: "Hidden Library Alias",
      },
      { context: { user: defaults.user } },
    );

    expect(response.results).toHaveLength(0);
  });

  test("only searches the requested Library", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Mars Search Brand" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Mars Search Bottle",
    });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const otherUser = await fixtures.User();
    const otherCollection = await fixtures.Collection({
      name: "Library",
      createdById: otherUser.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values([
      { collectionId: collection.id, bottleId: bottle.id },
      { collectionId: otherCollection.id, bottleId: bottle.id },
    ]);

    const response = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", query: "mars" },
      { context: { user: defaults.user } },
    );

    expect(response.results.map(({ bottle }) => bottle.id)).toEqual([
      bottle.id,
    ]);
  });

  test("matches a Library Bottle by the start of a word", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Springbank Local Barley" });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });

    const response = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", query: "springb" },
      { context: { user: defaults.user } },
    );

    expect(response.results.map(({ bottle }) => bottle.id)).toEqual([
      bottle.id,
    ]);
  });

  test("filters Library by an Entity in any producer role", async ({
    defaults,
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Role Producer",
      kind: "distillery",
    });
    const asBrand = await fixtures.Bottle({ brandId: entity.id });
    const asDistiller = await fixtures.Bottle({ distillerIds: [entity.id] });
    const asBottler = await fixtures.Bottle({ bottlerId: entity.id });
    const unrelated = await fixtures.Bottle();
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values(
      [asBrand, asDistiller, asBottler, unrelated].map((bottle) => ({
        collectionId: library.id,
        bottleId: bottle.id,
      })),
    );

    const response = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", entity: entity.id },
      { context: { user: defaults.user } },
    );

    expect(
      response.results.map((entry) => entry.bottle.id).sort((a, b) => a - b),
    ).toEqual([asBrand.id, asDistiller.id, asBottler.id].sort((a, b) => a - b));
  });

  test("filters Library by stated age range", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const nine = await fixtures.Bottle({ statedAge: 9 });
    const ten = await fixtures.Bottle({ statedAge: 10 });
    const twelve = await fixtures.Bottle({ statedAge: 12 });
    const thirteen = await fixtures.Bottle({ statedAge: 13 });
    const unstated = await fixtures.Bottle({ statedAge: null });
    await db.insert(collectionBottles).values(
      [nine, ten, twelve, thirteen, unstated].map((bottle) => ({
        collectionId: library.id,
        bottleId: bottle.id,
      })),
    );
    const context = { user: defaults.user };

    const tenToTwelve = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", age: "from10To12" },
      { context },
    );
    const noAge = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", age: "unstated" },
      { context },
    );

    expect(
      tenToTwelve.results.map((entry) => entry.bottle.id).sort((a, b) => a - b),
    ).toEqual([ten.id, twelve.id].sort((a, b) => a - b));
    expect(tenToTwelve.total).toBe(2);
    expect(noAge.results.map((entry) => entry.bottle.id)).toEqual([
      unstated.id,
    ]);
  });

  test("matches each Library stats count with its filter", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const brand = await fixtures.Entity({ name: "Count Brand" });
    const distiller = await fixtures.Entity({ name: "Count Distillery" });
    const bottles = await Promise.all([
      fixtures.Bottle({ brandId: brand.id, statedAge: 8 }),
      fixtures.Bottle({ brandId: brand.id, statedAge: 18 }),
      fixtures.Bottle({ distillerIds: [distiller.id], statedAge: 30 }),
      fixtures.Bottle({ distillerIds: [distiller.id], statedAge: null }),
    ]);
    // Empty bottles are listed by default, so the counts include them too.
    await db.insert(collectionBottles).values(
      bottles.map((bottle, index) => ({
        collectionId: library.id,
        bottleId: bottle.id,
        status: (["open", "empty", "empty", null] as const)[index],
      })),
    );
    const context = { user: defaults.user };
    const list = (
      filter: Partial<
        Pick<
          Inputs["collections"]["bottles"]["list"],
          "age" | "brand" | "distiller" | "status"
        >
      >,
    ) =>
      routerClient.collections.bottles.list(
        { user: "me", collection: "library", ...filter },
        { context },
      );

    const stats = await routerClient.users.libraryStats(
      { user: "me" },
      { context },
    );

    expect((await list({})).total).toBe(stats.total);
    for (const [status, count] of [
      ["open", stats.status.open],
      ["sealed", stats.status.sealed],
      ["empty", stats.status.empty],
      ["unset", stats.status.unspecified],
    ] as const) {
      expect((await list({ status })).total, status).toBe(count);
    }
    for (const bucket of stats.age.buckets) {
      expect((await list({ age: bucket.id })).total, bucket.id).toBe(
        bucket.count,
      );
    }
    for (const item of stats.brands) {
      expect((await list({ brand: item.id })).total).toBe(item.count);
    }
    for (const item of stats.distillers) {
      expect((await list({ distiller: item.id })).total).toBe(item.count);
    }
  });

  test("rejects the age filter outside Library", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.collections.bottles.list(
        { user: "me", collection: "default", age: "under10" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Collection filters are only supported for Library.]`,
    );
  });

  test("rejects the removed target filter", async ({ defaults, fixtures }) => {
    const error = await waitError(() =>
      routerClient.collections.bottles.list(
        // SAFETY: This invalid legacy field exercises the runtime input boundary.
        {
          user: "me",
          collection: "library",
          target: 1,
        } as never,
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
  });
});
