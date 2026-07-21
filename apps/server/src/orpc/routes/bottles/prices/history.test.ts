import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottles,
  catalogTargets,
  storePrices,
} from "@peated/server/db/schema";
import type * as LogModule from "@peated/server/lib/log";
import { logTelemetryError } from "@peated/server/lib/log";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

vi.mock("@peated/server/lib/log", async (importOriginal) => {
  const actual = await importOriginal<typeof LogModule>();
  return {
    ...actual,
    logTelemetryError: vi.fn(actual.logTelemetryError),
  };
});

describe("GET /bottles/:bottle/price-history", () => {
  test("lists bottle history", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.StorePrice({
      bottleId: bottle.id,
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.length).toBe(1);
  });

  test("aggregates history only for the selected Bottle exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const otherTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    if (!target || !otherTarget) throw new Error("Missing target fixture");
    const included = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      targetId: target.id,
      name: "Included target-backed price",
    });
    const excluded = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      name: "Excluded stale-pair price",
    });
    await db
      .update(storePrices)
      .set({ updatedAt: new Date() })
      .where(eq(storePrices.id, included.id));
    await fixtures.StorePriceHistory({
      priceId: included.id,
      price: 12_300,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fixtures.StorePriceHistory({
      priceId: excluded.id,
      price: 99_900,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { results } = await routerClient.bottles.prices.history({
      bottle: bottle.id,
    });

    expect(results.map(({ avgPrice }) => avgPrice)).toContain(16);
    expect(results.map(({ avgPrice }) => avgPrice)).not.toContain(133);
  });

  test("measures promoted retained history without including it", async ({
    fixtures,
  }) => {
    const telemetry = vi.mocked(logTelemetryError);
    telemetry.mockClear();
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        name: `${parent.name} promoted`,
        fullName: `${parent.fullName} promoted`,
        createdByActorId: parent.createdByActorId,
      })
      .returning();
    if (!promotedBottle) throw new Error("Missing promoted Bottle fixture");
    const [target] = await db
      .insert(catalogTargets)
      .values({
        groupId: parent.groupId as number,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!target) throw new Error("Missing promoted target fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const targetless = await fixtures.StorePrice({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Targetless promoted history",
      price: 90_000,
    });
    const targetCorrect = await fixtures.StorePrice({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
      name: "Target-backed promoted history",
      price: 15_000,
    });
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, targetless.id));
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, targetCorrect.id));

    const { results } = await routerClient.bottles.prices.history({
      bottle: promotedBottle.id,
    });

    expect(results.map(({ avgPrice }) => avgPrice)).toEqual([20]);
    const filterEvents = telemetry.mock.calls.filter(
      ([, options]) =>
        options?.extra?.event === "catalog_target.read_filter_parity_mismatch",
    );
    expect(filterEvents).toHaveLength(1);
    expect(filterEvents[0]?.[1]?.extra).toMatchObject({
      event: "catalog_target.read_filter_parity_mismatch",
      consumerTable: "store_price",
      rowLocator: { id: targetless.id },
      caller: "bottles.prices.history",
      filter: "catalog_reference",
      targetMatches: false,
      legacyMatches: true,
    });
  });
});
