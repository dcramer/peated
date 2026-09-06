import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ScraperActivity from "./scraperActivity.stylex";

const emptyHealth = {
  requests: 0,
  requestErrors: 0,
  requestErrorsComplete: true,
  runs: 0,
  failedRuns: 0,
};

const data = {
  totals: {
    requests: 73,
    requestErrors: 2,
    requestErrorsComplete: true,
    runs: 7,
    failedRuns: 1,
  },
  saved: {
    reviews: { total: 20, new: 8, existing: 12 },
    prices: { total: 17, new: 6, existing: 11 },
    bottles: { total: 7, new: 2, existing: 5 },
  },
  days: [
    {
      date: "2026-09-05",
      requests: 42,
      requestErrors: 2,
      requestErrorsComplete: true,
      runs: 4,
      failedRuns: 1,
      reviews: 12,
      prices: 9,
      bottles: 4,
    },
    {
      date: "2026-09-04",
      requests: 31,
      requestErrors: 0,
      requestErrorsComplete: true,
      runs: 3,
      failedRuns: 0,
      reviews: 8,
      prices: 8,
      bottles: 3,
    },
  ],
  recentFailures: [],
};

describe("ScraperActivity", () => {
  it("shows chronological charts with exact daily labels", () => {
    const html = renderToStaticMarkup(<ScraperActivity data={data} />);
    const savedChart = html.match(
      /<ol aria-label="Saved items by day"[\s\S]*?<\/ol>/,
    )?.[0];

    expect(savedChart).toBeDefined();
    expect(savedChart!.indexOf("September 4, 2026")).toBeLessThan(
      savedChart!.indexOf("September 5, 2026"),
    );
    expect(savedChart).toContain("12 reviews, 9 prices, 4 bottles");
    expect(html).toContain('aria-label="Requests by day"');
    expect(html).toContain("42 requests, 4 runs, 2 failed requests");
    expect(html).toContain("Daily details");
  });

  it("omits empty charts", () => {
    const html = renderToStaticMarkup(
      <ScraperActivity
        data={{
          totals: emptyHealth,
          saved: {
            reviews: { total: 0, new: 0, existing: 0 },
            prices: { total: 0, new: 0, existing: 0 },
            bottles: { total: 0, new: 0, existing: 0 },
          },
          days: [
            {
              date: "2026-09-05",
              ...emptyHealth,
              reviews: 0,
              prices: 0,
              bottles: 0,
            },
          ],
          recentFailures: [],
        }}
      />,
    );

    expect(html).toContain("No scraper activity in the last 30 days.");
    expect(html).not.toContain('aria-label="Saved items by day"');
  });

  it("explains when runs saved no items", () => {
    const html = renderToStaticMarkup(
      <ScraperActivity
        data={{
          totals: { ...emptyHealth, runs: 1 },
          saved: {
            reviews: { total: 0, new: 0, existing: 0 },
            prices: { total: 0, new: 0, existing: 0 },
            bottles: { total: 0, new: 0, existing: 0 },
          },
          days: [
            {
              date: "2026-09-05",
              ...emptyHealth,
              runs: 1,
              reviews: 0,
              prices: 0,
              bottles: 0,
            },
          ],
          recentFailures: [],
        }}
      />,
    );

    expect(html).toContain("No items saved");
    expect(html).toContain("No reviews, prices or bottles were saved.");
  });
});
