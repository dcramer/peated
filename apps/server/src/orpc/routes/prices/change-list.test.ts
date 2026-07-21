import { db } from "@peated/server/db";
import { catalogTargets, collectionBottles } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

describe("GET /price-changes", () => {
  test("lists price changes", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      price: 10000, // $100
      updatedAt: new Date(),
    });
    await fixtures.StorePriceHistory({
      priceId: price.id,
      price: 5000, // $50
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    });

    const { results } = await routerClient.prices.changeList({});
    const targetId = await exactTargetId(bottle.id);

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(targetId);
    expect(results[0].price).toEqual(10000);
    expect(results[0].previousPrice).toEqual(5000);
    expect(results[0].target).toMatchObject({
      kind: "bottle",
      targetId,
      bottle: { id: bottle.id },
    });
  });

  test("filters by query", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Test Bottle 1" });
    const bottle2 = await fixtures.Bottle({ name: "Another Bottle" });

    const price1 = await fixtures.StorePrice({
      bottleId: bottle1.id,
      name: "Test Bottle 1",
      price: 10000,
      updatedAt: new Date(),
    });
    const price2 = await fixtures.StorePrice({
      bottleId: bottle2.id,
      name: "Another Bottle",
      price: 10000,
      updatedAt: new Date(),
    });

    await fixtures.StorePriceHistory({
      priceId: price1.id,
      price: 5000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: price2.id,
      price: 5000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { results } = await routerClient.prices.changeList({
      query: "Test",
    });

    expect(results.length).toBe(1);
    expect(results[0].target).toMatchObject({
      kind: "bottle",
      bottle: { name: "Test Bottle 1" },
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
          price: 10000,
          updatedAt: new Date(),
        });
        await fixtures.StorePriceHistory({
          priceId: price.id,
          price: 5000,
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }),
    );

    const { results, rel } = await routerClient.prices.changeList({
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBeNull();
  });

  test("groups by authoritative exact or generic target and currency", async ({
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle({ name: "Exact change" });
    const retainedOther = await fixtures.Bottle({ name: "Retained drift" });
    const retainedSecond = await fixtures.Bottle({ name: "Retained drift 2" });
    const genericParent = await fixtures.Bottle({ name: "Generic change" });
    await fixtures.BottleRelease({ bottleId: genericParent.id });
    const exactTarget = await exactTargetId(exactBottle.id);
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, genericParent.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");
    const exactPrice = await fixtures.StorePrice({
      bottleId: retainedOther.id,
      targetId: exactTarget,
      name: "Exact target price change",
      price: 10_000,
      updatedAt: new Date(),
    });
    const exactEuroPrice = await fixtures.StorePrice({
      bottleId: retainedOther.id,
      targetId: exactTarget,
      name: "Exact target euro price change",
      price: 15_000,
      currency: "eur",
      updatedAt: new Date(),
    });
    const exactSecondPrice = await fixtures.StorePrice({
      bottleId: retainedSecond.id,
      targetId: exactTarget,
      name: "Exact target second price change",
      price: 14_000,
      updatedAt: new Date(),
    });
    const genericPrice = await fixtures.StorePrice({
      bottleId: genericParent.id,
      targetId: genericTarget.id,
      name: "Generic target price change",
      price: 20_000,
      updatedAt: new Date(),
    });
    await fixtures.StorePriceHistory({
      priceId: exactPrice.id,
      price: 5_000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: exactEuroPrice.id,
      price: 7_000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: exactSecondPrice.id,
      price: 9_000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: genericPrice.id,
      price: 10_000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { results } = await routerClient.prices.changeList({});
    const byTargetAndCurrency = Object.fromEntries(
      results.map((change) => [`${change.id}:${change.currency}`, change]),
    );
    expect(
      results.map((change) => `${change.id}:${change.currency}`).sort(),
    ).toEqual(
      [
        `${exactTarget}:usd`,
        `${exactTarget}:eur`,
        `${genericTarget.id}:usd`,
      ].sort(),
    );

    expect(byTargetAndCurrency[`${exactTarget}:usd`]).toMatchObject({
      price: 12_000,
      previousPrice: 7_000,
      currency: "usd",
      target: {
        kind: "bottle",
        bottle: { id: exactBottle.id },
      },
    });
    expect(byTargetAndCurrency[`${exactTarget}:eur`]).toMatchObject({
      price: 15_000,
      previousPrice: 7_000,
      currency: "eur",
      target: {
        kind: "bottle",
        bottle: { id: exactBottle.id },
      },
    });
    expect(byTargetAndCurrency[`${exactTarget}:usd`]).toMatchObject({
      isLibrary: false,
      hasTasted: false,
    });
    expect(byTargetAndCurrency[`${genericTarget.id}:usd`]).toMatchObject({
      price: 20_000,
      previousPrice: 10_000,
      currency: "usd",
      target: {
        kind: "group",
        group: { id: genericParent.groupId },
      },
      isLibrary: false,
      hasTasted: false,
    });
  });

  test("returns target-keyed Library and tasted state for the current user", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const exactBottle = await fixtures.Bottle({ name: "Library change" });
    const genericParent = await fixtures.Bottle({ name: "Tasted change" });
    await fixtures.BottleRelease({ bottleId: genericParent.id });
    const exactTarget = await exactTargetId(exactBottle.id);
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, genericParent.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");
    const exactPrice = await fixtures.StorePrice({
      bottleId: genericParent.id,
      targetId: exactTarget,
      name: "Library target price change",
      price: 10_000,
      updatedAt: new Date(),
    });
    const genericPrice = await fixtures.StorePrice({
      bottleId: exactBottle.id,
      targetId: genericTarget.id,
      name: "Tasted target price change",
      price: 20_000,
      updatedAt: new Date(),
    });
    await fixtures.StorePriceHistory({
      priceId: exactPrice.id,
      price: 5_000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: genericPrice.id,
      price: 10_000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const library = await fixtures.Collection({
      createdById: user.id,
      name: "Library",
    });
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: genericParent.id,
      targetId: exactTarget,
    });
    await fixtures.Tasting({
      bottleId: exactBottle.id,
      targetId: genericTarget.id,
      createdById: user.id,
    });

    const { results } = await routerClient.prices.changeList(
      {},
      { context: { user } },
    );
    const byId = Object.fromEntries(
      results.map((change) => [change.id, change]),
    );

    expect(byId[exactTarget]).toMatchObject({
      isLibrary: true,
      hasTasted: false,
    });
    expect(byId[genericTarget.id]).toMatchObject({
      isLibrary: false,
      hasTasted: true,
    });
  });
});
