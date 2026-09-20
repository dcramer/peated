import { db } from "@peated/server/db";
import {
  bottleSeries,
  bottleSeriesTombstones,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottle-series/{series}/rating", () => {
  test("combines member review scores across active Bottles into one median", async ({
    fixtures,
    defaults,
  }) => {
    const series = await fixtures.BottleSeries();
    const first = await fixtures.Bottle({ seriesId: series.id });
    const second = await fixtures.Bottle({ seriesId: series.id });
    const unrelated = await fixtures.Bottle();
    const otherMember = await fixtures.User();
    const privateMember = await fixtures.User({ private: true });
    await db.insert(memberReviews).values([
      { bottleId: first.id, createdById: defaults.user.id, score: 80 },
      { bottleId: first.id, createdById: privateMember.id, score: 95 },
      { bottleId: second.id, createdById: otherMember.id, score: 90 },
      { bottleId: unrelated.id, createdById: defaults.user.id, score: 100 },
    ]);
    await fixtures.Tasting({
      bottleId: first.id,
      createdById: defaults.user.id,
      ratingBand: "good",
    });
    await fixtures.Tasting({
      bottleId: second.id,
      createdById: defaults.user.id,
      ratingBand: "outstanding",
    });

    const result = await routerClient.bottleSeries.rating({
      series: series.id,
    });

    expect(result).toMatchObject({
      totalBottles: 2,
      medianScore: 90,
      minScore: 80,
      maxScore: 95,
      memberScoreCount: 3,
      externalScoreCount: 0,
      reviewScoreBandCounts: {
        mediocre: 0,
        good: 1,
        very_good: 0,
        outstanding: 1,
        unicorn: 1,
      },
      tastingBandCounts: {
        mediocre: 0,
        good: 1,
        very_good: 0,
        outstanding: 1,
        unicorn: 0,
      },
    });
  });

  test("deduplicates one member across Bottles and counts tasting band totals", async ({
    fixtures,
    defaults,
  }) => {
    const series = await fixtures.BottleSeries();
    const first = await fixtures.Bottle({ seriesId: series.id });
    const second = await fixtures.Bottle({ seriesId: series.id });
    await fixtures.Tasting({
      bottleId: first.id,
      createdById: defaults.user.id,
      ratingBand: "good",
    });
    await fixtures.Tasting({
      bottleId: second.id,
      createdById: defaults.user.id,
      ratingBand: "unicorn",
    });

    const result = await routerClient.bottleSeries.rating({
      series: series.id,
    });

    expect(result).toMatchObject({
      totalBottles: 2,
      medianScore: null,
      memberScoreCount: 0,
      externalScoreCount: 0,
      raterCount: 1,
      tastingBandCounts: {
        mediocre: 0,
        good: 1,
        very_good: 0,
        outstanding: 0,
        unicorn: 1,
      },
    });
  });

  test("returns an empty rating for a Series without rated Bottles", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries();
    await fixtures.Bottle({ seriesId: series.id });

    const result = await routerClient.bottleSeries.rating({
      series: series.id,
    });

    expect(result).toMatchObject({
      totalBottles: 1,
      medianScore: null,
      minScore: null,
      maxScore: null,
      memberScoreCount: 0,
      externalScoreCount: 0,
      raterCount: 0,
      reviewScoreBandCounts: {
        mediocre: 0,
        good: 0,
        very_good: 0,
        outstanding: 0,
        unicorn: 0,
      },
      tastingBandCounts: {
        mediocre: 0,
        good: 0,
        very_good: 0,
        outstanding: 0,
        unicorn: 0,
      },
    });
  });

  test("resolves a merged Series to its new id", async ({ fixtures }) => {
    const series = await fixtures.BottleSeries();
    const merged = await fixtures.BottleSeries();
    await db.insert(bottleSeriesTombstones).values({
      seriesId: series.id,
      newSeriesId: merged.id,
    });
    await db.delete(bottleSeries).where(eq(bottleSeries.id, series.id));
    const bottle = await fixtures.Bottle({ seriesId: merged.id });
    await db.insert(memberReviews).values({
      bottleId: bottle.id,
      createdById: (await fixtures.User()).id,
      score: 87,
    });

    const result = await routerClient.bottleSeries.rating({
      series: series.id,
    });

    expect(result.totalBottles).toBe(1);
    expect(result.medianScore).toBe(87);
  });

  test("returns not found for a missing Series", async () => {
    await expect(
      routerClient.bottleSeries.rating({ series: 999_999_999 }),
    ).rejects.toThrow("Series not found.");
  });
});
