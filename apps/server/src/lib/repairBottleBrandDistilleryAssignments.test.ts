import { db } from "@peated/server/db";
import {
  bottleSeries,
  bottles,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { repairBottleBrandDistilleryAssignments } from "@peated/server/lib/repairBottleBrandDistilleryAssignments";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pushUniqueJobMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: pushUniqueJobMock,
}));

describe("repairBottleBrandDistilleryAssignments", () => {
  beforeEach(() => {
    pushUniqueJobMock.mockReset();
  });

  test("previews Jura-style repairs without mutating bottle data", async ({
    fixtures,
  }) => {
    const fromBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({
      name: "Jura",
      type: ["brand"],
    });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "12-year-old",
    });
    const bottle = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "12-year-old Single Malt Scotch Whisky",
      seriesId: sourceSeries.id,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "2024 Release",
    });

    const result = await repairBottleBrandDistilleryAssignments({
      distilleryId: fromBrand.id,
      dryRun: true,
      fromBrand,
      toBrand,
    });

    expect(result.summary).toEqual({
      applied: 0,
      failed: 0,
      planned: 1,
      seriesCreated: 1,
      seriesReused: 0,
      total: 1,
    });
    expect(result.items).toEqual([
      {
        bottleFullName: bottle.fullName,
        bottleId: bottle.id,
        distilleryAdded: true,
        message:
          "brand Isle of Jura -> Jura; add distillery Isle of Jura; create series 12-year-old; 1 release(s) reindexed",
        releaseCount: 1,
        seriesAction: "create_new",
        status: "planned",
      },
    ]);

    const [unchangedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(unchangedBottle.brandId).toEqual(fromBrand.id);
    expect(unchangedBottle.seriesId).toEqual(sourceSeries.id);

    const distilleryLinks = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distilleryLinks).toHaveLength(0);

    const targetSeries = await db.query.bottleSeries.findFirst({
      where: and(
        eq(bottleSeries.brandId, toBrand.id),
        eq(bottleSeries.name, sourceSeries.name),
      ),
    });
    expect(targetSeries).toBeUndefined();
    expect(pushUniqueJobMock).not.toHaveBeenCalled();
  });

  test("repairs the bottle brand, adds the distillery, and creates a target series without renaming the bottle", async ({
    fixtures,
  }) => {
    const systemUser = await fixtures.User({ admin: true });
    const fromBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({
      name: "Jura",
      type: ["brand"],
    });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "12-year-old",
    });
    const bottle = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "12-year-old Single Malt Scotch Whisky",
      seriesId: sourceSeries.id,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "2024 Release",
    });

    const result = await repairBottleBrandDistilleryAssignments({
      distilleryId: fromBrand.id,
      dryRun: false,
      fromBrand,
      toBrand,
      user: systemUser,
    });

    expect(result.summary).toEqual({
      applied: 1,
      failed: 0,
      planned: 0,
      seriesCreated: 1,
      seriesReused: 0,
      total: 1,
    });

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.brandId).toEqual(toBrand.id);
    expect(updatedBottle.fullName).toEqual(bottle.fullName);
    expect(updatedBottle.seriesId).not.toEqual(sourceSeries.id);

    const distilleryLinks = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distilleryLinks).toHaveLength(1);
    expect(distilleryLinks[0]?.distillerId).toEqual(fromBrand.id);

    const [reindexedSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, updatedBottle.seriesId!));
    expect(reindexedSeries.brandId).toEqual(toBrand.id);
    expect(reindexedSeries.name).toEqual(sourceSeries.name);

    const [updatedSourceSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, sourceSeries.id));
    expect(updatedSourceSeries.numReleases).toEqual(0);
    expect(reindexedSeries.numReleases).toEqual(1);

    const change = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectId, bottle.id),
        eq(changes.objectType, "bottle"),
        eq(changes.type, "update"),
      ),
      orderBy: (changes, { desc }) => [desc(changes.createdAt)],
    });
    expect(change?.createdById).toEqual(systemUser.id);
    expect(change?.data).toEqual({
      brandId: toBrand.id,
      distillerIds: [fromBrand.id],
      seriesId: reindexedSeries.id,
    });

    expect(pushUniqueJobMock).toHaveBeenCalledWith(
      "OnBottleChange",
      { bottleId: bottle.id },
      { delay: 5000 },
    );
    expect(pushUniqueJobMock).toHaveBeenCalledWith(
      "OnBottleReleaseChange",
      { releaseId: release.id },
      { delay: 5000 },
    );
    expect(pushUniqueJobMock).toHaveBeenCalledWith(
      "IndexBottleSeriesSearchVectors",
      { seriesId: reindexedSeries.id },
      { delay: 5000 },
    );
    expect(pushUniqueJobMock).toHaveBeenCalledWith(
      "OnEntityChange",
      { entityId: fromBrand.id },
      { delay: 5000 },
    );
    expect(pushUniqueJobMock).toHaveBeenCalledWith(
      "OnEntityChange",
      { entityId: toBrand.id },
      { delay: 5000 },
    );
  });

  test("reuses an existing target-brand series and avoids duplicate distillery links", async ({
    fixtures,
  }) => {
    const systemUser = await fixtures.User({ admin: true });
    const fromBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({
      name: "Jura",
      type: ["brand"],
    });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "Elixir",
    });
    const targetSeries = await fixtures.BottleSeries({
      brandId: toBrand.id,
      name: "Elixir",
    });
    const bottle = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "Elixir",
      seriesId: sourceSeries.id,
      distillerIds: [fromBrand.id],
    });

    const result = await repairBottleBrandDistilleryAssignments({
      distilleryId: fromBrand.id,
      dryRun: false,
      fromBrand,
      toBrand,
      user: systemUser,
    });

    expect(result.summary).toEqual({
      applied: 1,
      failed: 0,
      planned: 0,
      seriesCreated: 0,
      seriesReused: 1,
      total: 1,
    });

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.brandId).toEqual(toBrand.id);
    expect(updatedBottle.seriesId).toEqual(targetSeries.id);

    const distilleryLinks = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distilleryLinks).toHaveLength(1);
    expect(pushUniqueJobMock).not.toHaveBeenCalledWith(
      "IndexBottleSeriesSearchVectors",
      expect.anything(),
      expect.anything(),
    );
  });
});
