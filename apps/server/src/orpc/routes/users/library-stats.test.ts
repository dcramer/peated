import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  collectionBottles,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/library/stats", () => {
  test("returns empty insights when the Library does not exist", async ({
    defaults,
  }) => {
    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 0,
      status: { open: 0, sealed: 0, unspecified: 0 },
      brands: [],
      distillers: [],
      age: {
        knownCount: 0,
        median: null,
        oldest: null,
      },
      categories: [],
    });
    expect(data.age.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  test("summarizes non-empty Library entries", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const otherCollection = await fixtures.Collection({
      name: "Other Collection",
      createdById: defaults.user.id,
    });
    const distillerA = await fixtures.Entity({ name: "Alpha Distillery" });
    const distillerB = await fixtures.Entity({ name: "Beta Distillery" });
    const brandA = await fixtures.Entity({ name: "Alpha Brand" });
    const brandB = await fixtures.Entity({ name: "Beta Brand" });
    const youngBottle = await fixtures.Bottle({
      brandId: brandA.id,
      name: "Young Release",
      category: "single_malt",
      statedAge: 8,
    });
    const twelveYearBottle = await fixtures.Bottle({
      brandId: brandA.id,
      name: "Twelve Year Release",
      category: "bourbon",
      statedAge: 12,
    });
    const oldBottle = await fixtures.Bottle({
      brandId: brandA.id,
      name: "Old Release",
      category: "single_malt",
      statedAge: 25,
    });
    const unstatedBottle = await fixtures.Bottle({
      brandId: brandB.id,
      name: "Unstated Release",
      category: "rye",
      statedAge: null,
    });
    const emptyBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 50,
    });
    const otherBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 40,
    });

    await db.insert(bottlesToDistillers).values([
      { bottleId: youngBottle.id, distillerId: distillerA.id },
      { bottleId: twelveYearBottle.id, distillerId: distillerA.id },
      { bottleId: oldBottle.id, distillerId: distillerB.id },
      { bottleId: emptyBottle.id, distillerId: distillerB.id },
      { bottleId: otherBottle.id, distillerId: distillerB.id },
    ]);
    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: youngBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: twelveYearBottle.id,
        status: "sealed",
      },
      {
        collectionId: library.id,
        bottleId: oldBottle.id,
        status: null,
      },
      {
        collectionId: library.id,
        bottleId: unstatedBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: emptyBottle.id,
        status: "empty",
      },
      {
        collectionId: otherCollection.id,
        bottleId: otherBottle.id,
        status: "sealed",
      },
    ]);

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.total).toBe(4);
    expect(data.status).toEqual({ open: 2, sealed: 1, unspecified: 1 });
    expect(data.brands).toEqual([
      { id: brandA.id, name: brandA.name, count: 3 },
      { id: brandB.id, name: brandB.name, count: 1 },
    ]);
    expect(data.distillers).toEqual([
      { id: distillerA.id, name: distillerA.name, count: 2 },
      { id: distillerB.id, name: distillerB.name, count: 1 },
    ]);
    expect(data.age).toEqual({
      knownCount: 3,
      median: 12,
      oldest: 25,
      buckets: [
        { id: "under10", label: "Under 10", count: 1 },
        { id: "from10To12", label: "10–12", count: 1 },
        { id: "from13To17", label: "13–17", count: 0 },
        { id: "from18To24", label: "18–24", count: 0 },
        { id: "atLeast25", label: "25+", count: 1 },
        { id: "unstated", label: "Unstated", count: 1 },
      ],
    });
    expect(data.categories).toEqual([
      { category: "single_malt", count: 2 },
      { category: "bourbon", count: 1 },
      { category: "rye", count: 1 },
    ]);
  });

  test("uses Bottle-owned fields without BottleGroup hydration", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const exactDistiller = await fixtures.Entity({ name: "Exact Distillery" });
    const exactBottle = await fixtures.Bottle({
      category: "rye",
      statedAge: 8,
      distillerIds: [exactDistiller.id],
    });
    const retainedBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 50,
      distillerIds: [exactDistiller.id],
    });
    await db
      .update(bottleGroups)
      .set({ category: "bourbon", statedAge: 18 })
      .where(eq(bottleGroups.id, retainedBottle.groupId!));

    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: exactBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: retainedBottle.id,
        status: "sealed",
      },
    ]);

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 2,
      distillers: [
        { id: exactDistiller.id, name: exactDistiller.name, count: 2 },
      ],
      age: { knownCount: 2, median: 29, oldest: 50 },
      categories: [
        { category: "rye", count: 1 },
        { category: "single_malt", count: 1 },
      ],
    });
  });

  test("returns deterministic top-five distillers and categories", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const [alpha, bravo, charlie, delta, echo, zulu] = await Promise.all([
      fixtures.Entity({ name: "Alpha Distillery" }),
      fixtures.Entity({ name: "Bravo Distillery" }),
      fixtures.Entity({ name: "Charlie Distillery" }),
      fixtures.Entity({ name: "Delta Distillery" }),
      fixtures.Entity({ name: "Echo Distillery" }),
      fixtures.Entity({ name: "Zulu Distillery" }),
    ]);
    const bottleInputs = [
      { category: "blend" as const, distiller: alpha },
      { category: "blend" as const, distiller: alpha },
      { category: "blend" as const, distiller: alpha },
      { category: "bourbon" as const, distiller: bravo },
      { category: "bourbon" as const, distiller: bravo },
      { category: "rye" as const, distiller: zulu },
      { category: "rye" as const, distiller: zulu },
      { category: "single_grain" as const, distiller: charlie },
      { category: "single_malt" as const, distiller: delta },
      { category: "single_pot_still" as const, distiller: echo },
    ];
    const bottles = await Promise.all(
      bottleInputs.map(({ category, distiller }) =>
        fixtures.Bottle({ category, distillerIds: [distiller.id] }),
      ),
    );
    await db.insert(collectionBottles).values(
      bottles.map((bottle) => ({
        collectionId: library.id,
        bottleId: bottle.id,
        status: "open" as const,
      })),
    );

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.distillers).toEqual([
      { id: alpha.id, name: alpha.name, count: 3 },
      { id: bravo.id, name: bravo.name, count: 2 },
      { id: zulu.id, name: zulu.name, count: 2 },
      { id: charlie.id, name: charlie.name, count: 1 },
      { id: delta.id, name: delta.name, count: 1 },
    ]);
    expect(data.distillers).not.toContainEqual(
      expect.objectContaining({ id: echo.id }),
    );
    expect(data.categories).toEqual([
      { category: "blend", count: 3 },
      { category: "bourbon", count: 2 },
      { category: "rye", count: 2 },
      { category: "single_grain", count: 1 },
      { category: "single_malt", count: 1 },
    ]);
    expect(data.categories).not.toContainEqual({
      category: "single_pot_still",
      count: 1,
    });
  });

  test("summarizes every entry across the Library batch boundary", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const compatibilityBottle = await fixtures.Bottle({
      category: null,
      statedAge: null,
      distillerIds: [],
    });
    const additionalCompatibilityBottles = await db
      .insert(bottles)
      .values(
        Array.from({ length: 197 }, (_, index) => ({
          groupId: compatibilityBottle.groupId,
          fullName: `Library batch Bottle ${index}`,
          name: `Batch Bottle ${index}`,
          brandId: compatibilityBottle.brandId,
          createdByActorId: compatibilityBottle.createdByActorId,
        })),
      )
      .returning({ id: bottles.id });
    await db.insert(collectionBottles).values(
      [compatibilityBottle, ...additionalCompatibilityBottles].map(
        (bottle) => ({
          collectionId: library.id,
          bottleId: bottle.id,
          status: "open" as const,
        }),
      ),
    );

    const distillerA = await fixtures.Entity({ name: "Batch Distillery A" });
    const distillerB = await fixtures.Entity({ name: "Batch Distillery B" });
    const exactBottles = await Promise.all([
      fixtures.Bottle({
        category: "single_malt",
        statedAge: 8,
        distillerIds: [distillerA.id],
      }),
      fixtures.Bottle({
        category: "bourbon",
        statedAge: 12,
        distillerIds: [distillerA.id],
      }),
      fixtures.Bottle({
        category: "single_malt",
        statedAge: 25,
        distillerIds: [distillerB.id],
      }),
    ]);
    await db.insert(collectionBottles).values(
      exactBottles.map((bottle) => ({
        collectionId: library.id,
        bottleId: bottle.id,
        status: "sealed" as const,
      })),
    );

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 201,
      status: { open: 198, sealed: 3, unspecified: 0 },
      distillers: [
        { id: distillerA.id, name: distillerA.name, count: 2 },
        { id: distillerB.id, name: distillerB.name, count: 1 },
      ],
      age: {
        knownCount: 3,
        median: 12,
        oldest: 25,
        buckets: [
          { id: "under10", label: "Under 10", count: 1 },
          { id: "from10To12", label: "10–12", count: 1 },
          { id: "from13To17", label: "13–17", count: 0 },
          { id: "from18To24", label: "18–24", count: 0 },
          { id: "atLeast25", label: "25+", count: 1 },
          { id: "unstated", label: "Unstated", count: 198 },
        ],
      },
      categories: [
        { category: "single_malt", count: 2 },
        { category: "bourbon", count: 1 },
      ],
    });
  });

  test("uses the stored Bottle instead of another group member", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const parentDistiller = await fixtures.Entity({
      name: "Parent Distillery",
    });
    const parent = await fixtures.Bottle({
      category: "rye",
      statedAge: 50,
      distillerIds: [parentDistiller.id],
    });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId,
      statedAge: 21,
    });
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: promoted.id,
      status: "open",
    });

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 1,
      distillers: [
        {
          id: parentDistiller.id,
          name: parentDistiller.name,
          count: 1,
        },
      ],
      age: { knownCount: 1, median: 21, oldest: 21 },
      categories: [{ category: "rye", count: 1 }],
    });
  });

  test("uses direct Bottle identity for compatibility entries", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const retainedBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 25,
    });
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: retainedBottle.id,
      status: "open",
    });

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 1,
      distillers: [],
      age: {
        knownCount: 1,
        median: 25,
        oldest: 25,
        buckets: expect.arrayContaining([
          { id: "atLeast25", label: "25+", count: 1 },
        ]),
      },
      categories: [{ category: "single_malt", count: 1 }],
    });
  });

  test("fails closed when a direct Bottle is retired", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: bottle.id,
      status: "open",
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.users.libraryStats(
        { user: defaults.user.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("allows anonymous access to public Library insights", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ private: false });
    const library = await fixtures.Collection({
      name: "Library",
      createdById: user.id,
    });
    const bottle = await fixtures.Bottle({ statedAge: 12 });
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: bottle.id,
      status: "sealed",
    });

    const data = await routerClient.users.libraryStats(
      { user: user.id },
      { context: { user: null } },
    );

    expect(data).toMatchObject({ total: 1, age: { median: 12 } });
  });

  test("rejects private Library insights for other users", async ({
    defaults,
    fixtures,
  }) => {
    const privateUser = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.users.libraryStats(
        { user: privateUser.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
