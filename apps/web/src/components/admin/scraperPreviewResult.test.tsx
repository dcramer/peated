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
});
