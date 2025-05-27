import { db } from "@peated/server/db";
import { bottles, bottleSeries, changes } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /bottle-series/:series", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.bottleSeries.delete({
        series: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires moderator access", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        {
          series: 1,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("deletes a series and updates related bottles", async function ({
    fixtures,
  }) {
    const user = await fixtures.User({ admin: true });
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

    await routerClient.bottleSeries.delete(
      {
        series: series.id,
      },
      { context: { user } },
    );

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

  test("returns 404 for non-existent series", async function ({ fixtures }) {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        {
          series: 12345,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });
});
