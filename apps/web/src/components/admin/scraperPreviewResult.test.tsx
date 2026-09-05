import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScraperPreviewResult } from "./scraperPreviewResult.stylex";

type Result = ComponentProps<typeof ScraperPreviewResult>["result"];

function reviewPage(index: number): Result["pages"][number] {
  return {
    kind: "review",
    url: `https://example.com/reviews/${index}`,
    title: `Review ${index}`,
    publishedAt: null,
    reviews: [
      {
        name: `Bottle ${index}`,
        reviewerName: "Reviewer",
        nativeScore: null,
      },
    ],
  };
}

describe("ScraperPreviewResult", () => {
  it("shows three sample pages before the remaining pages", () => {
    const html = renderToStaticMarkup(
      <ScraperPreviewResult
        result={{
          issues: [],
          pages: [1, 2, 3, 4, 5].map(reviewPage),
        }}
      />,
    );
    const morePages = html.indexOf("<details");

    expect(html).toContain("Show 2 more pages");
    expect(html.indexOf("Review 3")).toBeLessThan(morePages);
    expect(html.indexOf("Review 4")).toBeGreaterThan(morePages);
  });

  it("shows catalog products without requiring a price", () => {
    const html = renderToStaticMarkup(
      <ScraperPreviewResult
        result={{
          issues: [],
          pages: [
            {
              kind: "catalog",
              url: "https://example.com/whisky/release",
              products: [
                {
                  externalProductId: "official-1",
                  name: "Official Release",
                  url: "https://example.com/whisky/release",
                  imageUrl: null,
                  volume: 700,
                  sourceBottleIdentity: {
                    brand: null,
                    bottler: null,
                    expression: null,
                    series: null,
                    distillery: null,
                    category: null,
                    stated_age: 12,
                    abv: 46,
                    release_year: 2026,
                    vintage_year: null,
                    cask_strength: null,
                    single_cask: null,
                    maturation: null,
                    cask_number: null,
                    outturn: null,
                    edition: "Autumn Edition",
                  },
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Official Release");
    expect(html).toContain(
      "700 ml · 46% ABV · 12 years · Autumn Edition · Released 2026 · Product ID official-1",
    );
    expect(html).toContain('href="https://example.com/whisky/release"');
    expect(html).not.toContain("NaN");
  });
});
