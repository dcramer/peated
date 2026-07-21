import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
  storePrices,
} from "@peated/server/db/schema";
import type * as LogModule from "@peated/server/lib/log";
import { logTelemetryError } from "@peated/server/lib/log";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

vi.mock("@peated/server/lib/log", async (importOriginal) => {
  const actual = await importOriginal<typeof LogModule>();
  return {
    ...actual,
    logTelemetryError: vi.fn(actual.logTelemetryError),
  };
});

describe("GET /bottles/:bottle", () => {
  test("get bottle by id", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.details({
      bottle: bottle.id,
    });
    expect(data.id).toEqual(bottle.id);
    expect("createdBy" in data).toBe(false);
  });

  test("uses bottle image as display image", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "https://example.com/bottle.png",
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      imageUrl: "https://example.com/release.png",
    });

    const data = await routerClient.bottles.details({
      bottle: bottle.id,
    });

    expect(data.imageUrl).toBe("https://example.com/bottle.png");
    expect(data.displayImageUrl).toBe("https://example.com/bottle.png");
  });

  test("uses bottling image as display fallback", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: null,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: `${bottle.name} Release A`,
      imageUrl: "https://example.com/release-a.png",
      totalTastings: 1,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: `${bottle.name} Release B`,
      imageUrl: "https://example.com/release-b.png",
      totalTastings: 5,
    });

    const data = await routerClient.bottles.details({
      bottle: bottle.id,
    });

    expect(data.imageUrl).toBeNull();
    expect(data.displayImageUrl).toBe("https://example.com/release-b.png");
  });

  test("errors on invalid bottle", async () => {
    const err = await waitError(routerClient.bottles.details({ bottle: 1 }));
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("gets bottle with tombstone", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
    await db.insert(bottleTombstones).values({
      bottleId: 999,
      newBottleId: bottle1.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const data = await routerClient.bottles.details({ bottle: 999 });
    expect(data.id).toEqual(bottle1.id);
  });

  test("selects lastPrice through the Bottle exact target", async ({
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
    const authoritative = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      targetId: target.id,
      name: "Authoritative detail price",
      updatedAt: new Date(Date.now() - 1_000),
    });
    await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      name: "Newer stale pair price",
      updatedAt: new Date(),
    });

    const data = await routerClient.bottles.details({ bottle: bottle.id });

    expect(data.lastPrice?.id).toBe(authoritative.id);
    expect(data.lastPrice?.target).toMatchObject({
      kind: "bottle",
      targetId: target.id,
      bottle: { id: bottle.id },
    });
  });

  test("measures the promoted retained top price without returning it", async ({
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
    const authoritative = await fixtures.StorePrice({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
      name: "Target-backed promoted detail price",
      updatedAt: new Date(Date.now() - 1_000),
    });
    const targetless = await fixtures.StorePrice({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Targetless promoted detail price",
      updatedAt: new Date(),
    });
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, authoritative.id));
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, targetless.id));

    const data = await routerClient.bottles.details({
      bottle: promotedBottle.id,
    });

    expect(data.lastPrice?.id).toBe(authoritative.id);
    const filterEvents = telemetry.mock.calls.filter(
      ([, options]) =>
        options?.extra?.event === "catalog_target.read_filter_parity_mismatch",
    );
    expect(filterEvents).toHaveLength(1);
    expect(filterEvents[0]?.[1]?.extra).toMatchObject({
      event: "catalog_target.read_filter_parity_mismatch",
      consumerTable: "store_price",
      rowLocator: { id: targetless.id },
      caller: "bottles.details",
      operation: "lastPriceFilter",
      filter: "catalog_reference",
      targetMatches: false,
      legacyMatches: true,
    });
  });
});
