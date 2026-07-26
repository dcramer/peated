import { db } from "@peated/server/db";
import { catalogTargets, collectionBottles } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

const ONE_WEEK_AGO = () =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

describe("GET /price-changes", () => {
  test("lists price changes by direct Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      price: 10_000,
      updatedAt: new Date(),
    });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      price: 5_000,
      date: ONE_WEEK_AGO(),
    });

    const { results } = await routerClient.prices.changeList({});

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: bottle.id,
      bottle: { id: bottle.id },
      price: 10_000,
      previousPrice: 5_000,
      isLibrary: false,
      hasTasted: false,
    });
    expect(results[0]).not.toHaveProperty("target");
  });

  test("filters by listing name", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Test Bottle 1" });
    const bottle2 = await fixtures.Bottle({ name: "Another Bottle" });

    const price1 = await fixtures.StorePrice({
      bottleId: bottle1.id,
      name: "Test Bottle 1",
      price: 10_000,
      updatedAt: new Date(),
    });
    const price2 = await fixtures.StorePrice({
      bottleId: bottle2.id,
      name: "Another Bottle",
      price: 10_000,
      updatedAt: new Date(),
    });

    await fixtures.StorePriceHistory({
      priceId: price1.id,
      price: 5_000,
      date: ONE_WEEK_AGO(),
    });
    await fixtures.StorePriceHistory({
      priceId: price2.id,
      price: 5_000,
      date: ONE_WEEK_AGO(),
    });

    const { results } = await routerClient.prices.changeList({
      query: "Test",
    });

    expect(results).toHaveLength(1);
    expect(results[0].bottle).toMatchObject({
      id: bottle1.id,
      name: "Test Bottle 1",
    });
  });

  test("paginates results", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottles = await Promise.all(
      Array.from({ length: 3 }).map((_, i) =>
        fixtures.Bottle({ name: `Bottle ${i}` }),
      ),
    );

    await Promise.all(
      bottles.map(async (bottle) => {
        const price = await fixtures.StorePrice({
          externalSiteId: site.id,
          bottleId: bottle.id,
          price: 10_000,
          updatedAt: new Date(),
        });
        await fixtures.StorePriceHistory({
          priceId: price.id,
          price: 5_000,
          date: ONE_WEEK_AGO(),
        });
      }),
    );

    const { results, rel } = await routerClient.prices.changeList({
      limit: 2,
    });

    expect(results).toHaveLength(2);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBeNull();
  });

  test("groups by direct Bottle and currency regardless of target evidence", async ({
    fixtures,
  }) => {
    const evidenceBottle = await fixtures.Bottle({ name: "Target evidence" });
    const firstBottle = await fixtures.Bottle({ name: "First change" });
    const secondBottle = await fixtures.Bottle({ name: "Second change" });
    const staleTargetId = await exactTargetId(evidenceBottle.id);

    const firstUsd = await fixtures.StorePrice({
      bottleId: firstBottle.id,
      targetId: staleTargetId,
      name: "First USD price",
      price: 10_000,
      updatedAt: new Date(),
    });
    const firstUsdSecond = await fixtures.StorePrice({
      bottleId: firstBottle.id,
      targetId: staleTargetId,
      name: "First USD second price",
      price: 14_000,
      updatedAt: new Date(),
    });
    const firstEuro = await fixtures.StorePrice({
      bottleId: firstBottle.id,
      targetId: staleTargetId,
      name: "First EUR price",
      price: 15_000,
      currency: "eur",
      updatedAt: new Date(),
    });
    const secondUsd = await fixtures.StorePrice({
      bottleId: secondBottle.id,
      targetId: staleTargetId,
      name: "Second USD price",
      price: 20_000,
      updatedAt: new Date(),
    });
    await Promise.all([
      fixtures.StorePriceHistory({
        priceId: firstUsd.id,
        price: 5_000,
        date: ONE_WEEK_AGO(),
      }),
      fixtures.StorePriceHistory({
        priceId: firstUsdSecond.id,
        price: 9_000,
        date: ONE_WEEK_AGO(),
      }),
      fixtures.StorePriceHistory({
        priceId: firstEuro.id,
        price: 7_000,
        date: ONE_WEEK_AGO(),
      }),
      fixtures.StorePriceHistory({
        priceId: secondUsd.id,
        price: 10_000,
        date: ONE_WEEK_AGO(),
      }),
    ]);

    const { results } = await routerClient.prices.changeList({});
    const byBottleAndCurrency = Object.fromEntries(
      results.map((change) => [`${change.id}:${change.currency}`, change]),
    );

    expect(
      results.map((change) => `${change.id}:${change.currency}`).sort(),
    ).toEqual(
      [
        `${firstBottle.id}:usd`,
        `${firstBottle.id}:eur`,
        `${secondBottle.id}:usd`,
      ].sort(),
    );
    expect(byBottleAndCurrency[`${firstBottle.id}:usd`]).toMatchObject({
      bottle: { id: firstBottle.id },
      price: 12_000,
      previousPrice: 7_000,
    });
    expect(byBottleAndCurrency[`${firstBottle.id}:eur`]).toMatchObject({
      bottle: { id: firstBottle.id },
      price: 15_000,
      previousPrice: 7_000,
    });
    expect(byBottleAndCurrency[`${secondBottle.id}:usd`]).toMatchObject({
      bottle: { id: secondBottle.id },
      price: 20_000,
      previousPrice: 10_000,
    });
  });

  test("excludes unresolved listings even when target evidence exists", async ({
    fixtures,
  }) => {
    const evidenceBottle = await fixtures.Bottle();
    const resolvedBottle = await fixtures.Bottle();
    const targetId = await exactTargetId(evidenceBottle.id);
    const unresolved = await fixtures.StorePrice({
      bottleId: null,
      targetId,
      name: "Unresolved target evidence",
      price: 10_000,
      updatedAt: new Date(),
    });
    const resolved = await fixtures.StorePrice({
      bottleId: resolvedBottle.id,
      targetId: null,
      name: "Resolved without target evidence",
      price: 20_000,
      updatedAt: new Date(),
    });
    await Promise.all([
      fixtures.StorePriceHistory({
        priceId: unresolved.id,
        price: 5_000,
        date: ONE_WEEK_AGO(),
      }),
      fixtures.StorePriceHistory({
        priceId: resolved.id,
        price: 10_000,
        date: ONE_WEEK_AGO(),
      }),
    ]);

    const { results } = await routerClient.prices.changeList({});

    expect(results).toHaveLength(1);
    expect(results[0].bottle.id).toBe(resolvedBottle.id);
  });

  test("returns Bottle-keyed Library and tasted state", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const evidenceBottle = await fixtures.Bottle();
    const libraryBottle = await fixtures.Bottle({ name: "Library change" });
    const tastedBottle = await fixtures.Bottle({ name: "Tasted change" });
    const staleTargetId = await exactTargetId(evidenceBottle.id);
    const libraryPrice = await fixtures.StorePrice({
      bottleId: libraryBottle.id,
      targetId: staleTargetId,
      name: "Library Bottle price change",
      price: 10_000,
      updatedAt: new Date(),
    });
    const tastedPrice = await fixtures.StorePrice({
      bottleId: tastedBottle.id,
      targetId: staleTargetId,
      name: "Tasted Bottle price change",
      price: 20_000,
      updatedAt: new Date(),
    });
    await Promise.all([
      fixtures.StorePriceHistory({
        priceId: libraryPrice.id,
        price: 5_000,
        date: ONE_WEEK_AGO(),
      }),
      fixtures.StorePriceHistory({
        priceId: tastedPrice.id,
        price: 10_000,
        date: ONE_WEEK_AGO(),
      }),
    ]);
    const library = await fixtures.Collection({
      createdById: user.id,
      name: "Library",
    });
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: libraryBottle.id,
      targetId: staleTargetId,
    });
    await fixtures.Tasting({
      bottleId: tastedBottle.id,
      targetId: staleTargetId,
      createdById: user.id,
    });

    const { results } = await routerClient.prices.changeList(
      {},
      { context: { user } },
    );
    const byId = Object.fromEntries(
      results.map((change) => [change.id, change]),
    );

    expect(byId[libraryBottle.id]).toMatchObject({
      bottle: { id: libraryBottle.id },
      isLibrary: true,
      hasTasted: false,
    });
    expect(byId[tastedBottle.id]).toMatchObject({
      bottle: { id: tastedBottle.id },
      isLibrary: false,
      hasTasted: true,
    });
  });
});
