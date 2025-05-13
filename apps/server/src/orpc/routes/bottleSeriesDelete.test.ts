import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db";
import { bottles, bottleSeries, changes } from "../../db/schema";
import waitError from "../../lib/test/waitError";
import { createCaller } from "../router";

describe("bottleSeriesDelete", () => {
  it("requires authentication", async () => {
    const caller = createCaller({ user: null });
    const err = await waitError(caller.bottleSeriesDelete(1));
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  it("requires moderator access", async ({ defaults }) => {
    const caller = createCaller({ user: defaults.user });
    const err = await waitError(caller.bottleSeriesDelete(1));
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  it("deletes a series and updates related bottles", async function ({
    fixtures,
  }) {
    const caller = createCaller({
      user: await fixtures.User({ admin: true }),
    });

    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Test Series",
      brandId: brand.id,
    });

    // Create some bottles in the series
    const bottle1 = await fixtures.Bottle({
      name: "Bottle 1",
      brandId: brand.id,
      seriesId: series.id,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Bottle 2",
      brandId: brand.id,
      seriesId: series.id,
    });

    await caller.bottleSeriesDelete(series.id);

    // Verify series is deleted
    const [deletedSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, series.id));
    expect(deletedSeries).toBeUndefined();

    // Verify bottles no longer reference the series
    const updatedBottles = await db
      .select()
      .from(bottles)
      .where(
        and(eq(bottles.brandId, brand.id), eq(bottles.name, bottle1.name)),
      );
    expect(updatedBottles[0].seriesId).toBeNull();

    // Verify change was recorded
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, series.id),
          eq(changes.objectType, "bottle_series"),
        ),
      );
    expect(change).toBeDefined();
    expect(change?.type).toBe("delete");
    expect(change?.data).toMatchObject({
      id: series.id,
      name: series.name,
      description: series.description,
      brandId: series.brandId,
    });
  });

  it("returns 404 for non-existent series", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ admin: true }),
    });

    const err = await waitError(caller.bottleSeriesDelete(12345));
    expect(err).toMatchInlineSnapshot(`[TRPCError: Series not found.]`);
  });
});
