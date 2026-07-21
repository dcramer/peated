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

describe("GET /bottles/:bottle/prices", () => {
  test("includes prices older than a week by default", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
      bottleId: bottle.id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      bottleId: bottle.id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
    });

    expect(result.results.length).toBe(2);
    expect(result.results[0].id).toBe(recentPrice.id);
    expect(result.results[1].id).toBe(oldPrice.id);
  });

  test("excludes prices older than a week when onlyValid is true", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
      bottleId: bottle.id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      bottleId: bottle.id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
      onlyValid: true,
    });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(recentPrice.id);
  });

  test("lists only the selected Bottle exact target despite retained-pair drift", async ({
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
    const site = await fixtures.ExternalSiteOrExisting();
    const authoritative = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      targetId: target.id,
      externalSiteId: site.id,
      name: "Authoritative exact target",
    });
    await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      externalSiteId: site.id,
      name: "Stale retained Bottle pair",
    });
    await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      externalSiteId: site.id,
      name: "Targetless compatibility row",
    });

    const result = await routerClient.bottles.prices.list({
      bottle: bottle.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([authoritative.id]);
    expect(result.results[0]?.target).toMatchObject({
      kind: "bottle",
      targetId: target.id,
      bottle: { id: bottle.id },
    });
  });

  test("measures promoted retained-pair membership without changing target results", async ({
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
      name: "Targetless promoted listing",
    });
    const targetCorrect = await fixtures.StorePrice({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
      name: "Target-backed promoted listing",
    });
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, targetless.id));
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, targetCorrect.id));

    const result = await routerClient.bottles.prices.list({
      bottle: promotedBottle.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([targetCorrect.id]);
    const filterEvents = telemetry.mock.calls.filter(
      ([, options]) =>
        options?.extra?.event === "catalog_target.read_filter_parity_mismatch",
    );
    expect(filterEvents).toHaveLength(1);
    expect(filterEvents[0]?.[1]?.extra).toMatchObject({
      event: "catalog_target.read_filter_parity_mismatch",
      consumerTable: "store_price",
      rowLocator: { id: targetless.id },
      caller: "bottles.prices.list",
      filter: "catalog_reference",
      targetMatches: false,
      legacyMatches: true,
    });
  });

  test("fails closed when a Bottle has no exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();

    await expect(
      routerClient.bottles.prices.list({ bottle: bottle.id }),
    ).rejects.toMatchObject({ code: "CATALOG_TARGET_NOT_FOUND" });
  });
});
