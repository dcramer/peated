import { db } from "@peated/server/db";
import { bottleImages, bottleSeries, bottles } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  getBottleSeriesMemberships,
  updateBottleSeriesReleaseCounts,
} from "./bottleSeriesReleaseCounts";
import {
  checkBottleSeriesRepresentatives,
  reconcileBottleSeriesRepresentatives,
  repairBottleSeriesRepresentative,
} from "./bottleSeriesRepresentatives";

async function addPrimaryImage(
  bottle: { id: number; createdByActorId: number },
  imageUrl: string,
) {
  await db.insert(bottleImages).values({
    bottleId: bottle.id,
    imageUrl,
    isPrimary: true,
    createdByActorId: bottle.createdByActorId,
  });
}

describe("BottleSeries representatives", () => {
  test("selects an image-bearing member and keeps it stable", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries();
    const first = await fixtures.Bottle({
      brandId: series.brandId,
      seriesId: series.id,
    });
    const second = await fixtures.Bottle({
      brandId: series.brandId,
      seriesId: series.id,
    });
    await addPrimaryImage(second, "/uploads/second.jpg");

    await db.transaction((tx) =>
      reconcileBottleSeriesRepresentatives(tx, [series.id]),
    );
    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).resolves.toMatchObject({ representativeBottleId: second.id });

    await addPrimaryImage(first, "/uploads/first.jpg");
    await expect(
      db.transaction((tx) =>
        reconcileBottleSeriesRepresentatives(tx, [series.id]),
      ),
    ).resolves.toEqual([]);
    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).resolves.toMatchObject({ representativeBottleId: second.id });
  });

  test("finds and repairs a representative from another series", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries();
    const eligible = await fixtures.Bottle({
      brandId: series.brandId,
      seriesId: series.id,
    });
    const otherSeries = await fixtures.BottleSeries();
    const unrelated = await fixtures.Bottle({
      brandId: otherSeries.brandId,
      seriesId: otherSeries.id,
    });
    await addPrimaryImage(eligible, "/uploads/eligible.jpg");
    await db
      .update(bottleSeries)
      .set({ representativeBottleId: unrelated.id })
      .where(eq(bottleSeries.id, series.id));

    await expect(
      checkBottleSeriesRepresentatives([series.id, otherSeries.id]),
    ).resolves.toEqual([
      {
        seriesId: series.id,
        savedBottleId: unrelated.id,
        actualBottleId: eligible.id,
      },
    ]);
    await expect(repairBottleSeriesRepresentative(series.id)).resolves.toEqual({
      seriesId: series.id,
      savedBottleId: unrelated.id,
      actualBottleId: eligible.id,
    });
    await expect(
      checkBottleSeriesRepresentatives([series.id]),
    ).resolves.toEqual([]);
  });

  test("replaces representatives when Bottle membership changes", async ({
    fixtures,
  }) => {
    const source = await fixtures.BottleSeries({ numReleases: 2 });
    const destination = await fixtures.BottleSeries({ numReleases: 0 });
    const moving = await fixtures.Bottle({
      brandId: source.brandId,
      seriesId: source.id,
    });
    const remaining = await fixtures.Bottle({
      brandId: source.brandId,
      seriesId: source.id,
    });
    await Promise.all([
      addPrimaryImage(moving, "/uploads/moving.jpg"),
      addPrimaryImage(remaining, "/uploads/remaining.jpg"),
    ]);
    await db.transaction((tx) =>
      reconcileBottleSeriesRepresentatives(tx, [source.id]),
    );

    await db.transaction(async (tx) => {
      const before = await getBottleSeriesMemberships(tx, [moving.id]);
      await tx
        .update(bottles)
        .set({ seriesId: destination.id })
        .where(eq(bottles.id, moving.id));
      const after = await getBottleSeriesMemberships(tx, [moving.id]);
      await updateBottleSeriesReleaseCounts(tx, before, after);
    });

    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, source.id),
      }),
    ).resolves.toMatchObject({ representativeBottleId: remaining.id });
    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, destination.id),
      }),
    ).resolves.toMatchObject({ representativeBottleId: moving.id });
  });
});
