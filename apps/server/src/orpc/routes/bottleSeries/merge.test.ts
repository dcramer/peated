import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
  changes,
} from "@peated/server/db/schema";
import { createBottle } from "@peated/server/lib/createBottle";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /bottle-series/:series/merge", () => {
  test("requires moderator access", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.bottleSeries.merge(
        { series: 1, other: 2, direction: "mergeInto" },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("moves bottles and preserves redirects and audit history", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Series Merge Brand" });
    const source = await fixtures.BottleSeries({
      name: "Release One",
      brandId: brand.id,
    });
    const destination = await fixtures.BottleSeries({
      name: "Signature Collection",
      brandId: brand.id,
    });
    const olderSource = await fixtures.BottleSeries({
      name: "Old Name",
      brandId: brand.id,
    });
    await db.insert(bottleSeriesTombstones).values({
      seriesId: olderSource.id,
      newSeriesId: source.id,
    });
    await db.delete(bottleSeries).where(eq(bottleSeries.id, olderSource.id));

    const grouped = await createBottle({
      context: { user },
      input: {
        name: "Port Charlotte",
        brand: brand.id,
        series: source.id,
        edition: "Batch One",
      },
    });
    const secondMember = await fixtures.BottleGroupMember({
      groupId: grouped.group.id,
      edition: "Batch Two",
    });
    const legacyBottle = await fixtures.LegacyBottle({
      name: "Legacy Release",
      brandId: brand.id,
      seriesId: source.id,
    });

    const result = await routerClient.bottleSeries.merge(
      {
        series: source.id,
        other: destination.id,
        direction: "mergeInto",
      },
      { context: { user } },
    );

    expect(result).toMatchObject({
      id: destination.id,
      peatedId: `S${String(destination.id).padStart(4, "0")}`,
      numReleases: 3,
    });
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, source.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, grouped.group.id),
      }),
    ).toMatchObject({ seriesId: destination.id });

    const updatedBottles = await db
      .select({ id: bottles.id, seriesId: bottles.seriesId })
      .from(bottles)
      .where(
        inArray(bottles.id, [
          grouped.bottle.id,
          secondMember.id,
          legacyBottle.id,
        ]),
      );
    expect(updatedBottles).toHaveLength(3);
    expect(
      updatedBottles.every(({ seriesId }) => seriesId === destination.id),
    ).toBe(true);

    expect(
      await db.query.bottleSeriesTombstones.findMany({
        where: inArray(bottleSeriesTombstones.seriesId, [
          olderSource.id,
          source.id,
        ]),
      }),
    ).toEqual(
      expect.arrayContaining([
        { seriesId: olderSource.id, newSeriesId: destination.id },
        { seriesId: source.id, newSeriesId: destination.id },
      ]),
    );
    expect(
      await db.query.changes.findFirst({
        where: and(
          eq(changes.objectType, "bottle_series"),
          eq(changes.objectId, source.id),
          eq(changes.type, "delete"),
        ),
      }),
    ).toMatchObject({
      data: expect.objectContaining({ destinationSeriesId: destination.id }),
    });

    await expect(
      routerClient.bottleSeries.details({ series: source.id }),
    ).resolves.toMatchObject({ id: destination.id });
    await expect(
      routerClient.bottleSeries.details({ series: olderSource.id }),
    ).resolves.toMatchObject({ id: destination.id });
  });

  test("rejects a merge across brands", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const firstBrand = await fixtures.Entity({ name: "First Brand" });
    const secondBrand = await fixtures.Entity({ name: "Second Brand" });
    const source = await fixtures.BottleSeries({
      name: "Source",
      brandId: firstBrand.id,
    });
    const destination = await fixtures.BottleSeries({
      name: "Destination",
      brandId: secondBrand.id,
    });

    const err = await waitError(() =>
      routerClient.bottleSeries.merge(
        {
          series: source.id,
          other: destination.id,
          direction: "mergeInto",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Only series from the same brand can be merged.]`,
    );
  });

  test("rolls back when a bottle group cannot be moved", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Atomic Series Brand" });
    const source = await fixtures.BottleSeries({
      name: "Source",
      brandId: brand.id,
    });
    const destination = await fixtures.BottleSeries({
      name: "Destination",
      brandId: brand.id,
    });
    const firstGroup = await createBottle({
      context: { user },
      input: {
        name: "First Bottle",
        brand: brand.id,
        series: source.id,
      },
    });
    const incompleteGroup = await createBottle({
      context: { user },
      input: {
        name: "Incomplete Bottle",
        brand: brand.id,
        series: source.id,
      },
    });
    await db
      .update(bottleGroups)
      .set({ representativeBottleId: null })
      .where(eq(bottleGroups.id, incompleteGroup.group.id));

    const err = await waitError(() =>
      routerClient.bottleSeries.merge(
        {
          series: source.id,
          other: destination.id,
          direction: "mergeInto",
        },
        { context: { user } },
      ),
    );

    expect(err.message).toBe(
      `Bottle group ${incompleteGroup.group.id} is incomplete and cannot be moved.`,
    );
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, source.id),
      }),
    ).toBeDefined();

    const groups = await db.query.bottleGroups.findMany({
      where: inArray(bottleGroups.id, [
        firstGroup.group.id,
        incompleteGroup.group.id,
      ]),
    });
    expect(groups).toHaveLength(2);
    expect(groups.every(({ seriesId }) => seriesId === source.id)).toBe(true);

    const members = await db.query.bottles.findMany({
      where: inArray(bottles.id, [
        firstGroup.bottle.id,
        incompleteGroup.bottle.id,
      ]),
    });
    expect(members).toHaveLength(2);
    expect(members.every(({ seriesId }) => seriesId === source.id)).toBe(true);
    expect(
      await db.query.changes.findFirst({
        where: and(
          eq(changes.objectType, "bottle_series"),
          eq(changes.objectId, source.id),
          eq(changes.type, "delete"),
        ),
      }),
    ).toBeUndefined();
  });
});
