import { db } from "@peated/server/db";
import { memberReviews, tastings } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottle-series/{series}/rating-summary", () => {
  it("combines ratings from active Bottles in the Series", async ({
    fixtures,
    defaults,
  }) => {
    const series = await fixtures.BottleSeries();
    const first = await fixtures.Bottle({ seriesId: series.id });
    const second = await fixtures.Bottle({ seriesId: series.id });
    const unrelated = await fixtures.Bottle();
    const otherUser = await fixtures.User();

    await db.insert(memberReviews).values([
      {
        bottleId: first.id,
        createdById: defaults.user.id,
        score: 91,
      },
      { bottleId: second.id, createdById: otherUser.id, score: 87 },
      { bottleId: unrelated.id, createdById: otherUser.id, score: 40 },
    ]);
    await db.insert(tastings).values([
      {
        bottleId: first.id,
        createdById: defaults.user.id,
        ratingBand: "outstanding",
      },
      {
        bottleId: second.id,
        createdById: otherUser.id,
        ratingBand: "very_good",
      },
      {
        bottleId: unrelated.id,
        createdById: otherUser.id,
        ratingBand: "mediocre",
      },
    ]);

    await expect(
      routerClient.bottleSeries.ratingSummary({ series: series.id }),
    ).resolves.toEqual({
      medianScore: 87,
      memberScoreCount: 2,
      externalScoreCount: 0,
      tastingBandCounts: {
        mediocre: 0,
        good: 0,
        very_good: 1,
        outstanding: 1,
        unicorn: 0,
      },
    });
  });

  it("returns an empty summary for a Series without Bottles", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries();
    const result = await routerClient.bottleSeries.ratingSummary({
      series: series.id,
    });

    expect(result.medianScore).toBeNull();
    expect(result.memberScoreCount).toBe(0);
    expect(result.externalScoreCount).toBe(0);
    expect(
      Object.values(result.tastingBandCounts).every((count) => count === 0),
    ).toBe(true);
  });

  it("returns not found for a missing Series", async () => {
    await expect(
      routerClient.bottleSeries.ratingSummary({ series: 999_999_999 }),
    ).rejects.toThrow("Series not found.");
  });
});
