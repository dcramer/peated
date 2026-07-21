import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
  storePrices,
} from "@peated/server/db/schema";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import type * as LogModule from "@peated/server/lib/log";
import { logTelemetryError } from "@peated/server/lib/log";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

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
    expect(data.group?.id).toEqual(bottle.groupId);
    expect("createdBy" in data).toBe(false);
  });

  test("uses the Bottle's own image", async ({ fixtures }) => {
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
    expect("displayImageUrl" in data).toBe(false);
  });

  test("does not fall back to a retained Bottling image", async ({
    fixtures,
  }) => {
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
    expect("displayImageUrl" in data).toBe(false);
  });

  test("errors on invalid bottle", async () => {
    const err = await waitError(routerClient.bottles.details({ bottle: 1 }));
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("fails closed for a legacy Bottle without an exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();

    const err = await waitError(
      routerClient.bottles.details({ bottle: bottle.id }),
    );

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

  test("counts people through the Bottle's exact target", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const sibling = await createConcreteBottle({
      context: { user: defaults.user },
      input: {
        kind: "source_bottle",
        sourceBottleId: bottle.id,
        exact: { edition: "Sibling Edition", releaseYear: 2026 },
      },
    });
    const [target, siblingTarget, genericTarget] = await Promise.all([
      db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, bottle.id),
      }),
      db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, sibling.bottle.id),
      }),
      db.query.catalogTargets.findFirst({
        where: and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
      }),
    ]);
    if (!target || !siblingTarget || !genericTarget) {
      throw new Error("Missing CatalogTarget fixture");
    }
    const exactPerson = await fixtures.User();
    const siblingPerson = await fixtures.User();
    const genericPerson = await fixtures.User();
    await fixtures.Tasting({
      bottleId: sibling.bottle.id,
      targetId: target.id,
      createdById: exactPerson.id,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: siblingTarget.id,
      createdById: siblingPerson.id,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: genericTarget.id,
      createdById: genericPerson.id,
    });

    const [selectedDetails, siblingDetails] = await Promise.all([
      routerClient.bottles.details({ bottle: bottle.id }),
      routerClient.bottles.details({ bottle: sibling.bottle.id }),
    ]);

    expect(selectedDetails.people).toBe(1);
    expect(siblingDetails.people).toBe(1);
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
