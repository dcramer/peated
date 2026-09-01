import { db } from "@peated/server/db";
import {
  bottleSeries,
  bottleSeriesTombstones,
  changes,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /bottle-series/:series", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.bottleSeries.delete({ series: 1 }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires moderator access", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        { series: 1 },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects deletion when the series has bottles", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Series Delete Brand" });
    const series = await fixtures.BottleSeries({
      name: "Populated Series",
      brandId: brand.id,
    });
    const bottle = await fixtures.LegacyBottle({
      name: "Member Bottle",
      brandId: brand.id,
      seriesId: series.id,
    });

    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        { series: series.id },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: This series still contains bottles. Merge it instead.]`,
    );
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).toBeDefined();
    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ seriesId: series.id });
  });

  test("deletes an empty series and preserves its public ID", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Empty Series Brand" });
    const series = await fixtures.BottleSeries({
      name: "Empty Series",
      brandId: brand.id,
    });

    await routerClient.bottleSeries.delete(
      { series: series.id },
      { context: { user } },
    );

    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleSeriesTombstones.findFirst({
        where: eq(bottleSeriesTombstones.seriesId, series.id),
      }),
    ).toEqual({ seriesId: series.id, newSeriesId: null });
    expect(
      await db.query.changes.findFirst({
        where: and(
          eq(changes.objectType, "bottle_series"),
          eq(changes.objectId, series.id),
          eq(changes.type, "delete"),
        ),
      }),
    ).toMatchObject({ displayName: series.name });
  });

  test("returns 404 for a missing series", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        { series: 12345 },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });
});
