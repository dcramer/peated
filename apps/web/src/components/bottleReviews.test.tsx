import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExternalReviewList } from "./bottleReviews";

type ExternalReviewListItem =
  Outputs["externalReviews"]["list"]["results"][number];

const timestamp = "2026-07-22T12:00:00.000Z";

function makeExternalReview(
  overrides: Partial<ExternalReviewListItem> = {},
): ExternalReviewListItem {
  return {
    id: 1,
    name: "Springbank 12 Cask Strength",
    url: "https://example.com/reviews/springbank",
    site: {
      id: 2,
      type: "whiskyadvocate",
      name: "Whisky Advocate",
      lastRunAt: null,
      nextRunAt: null,
      runEvery: null,
    },
    article: {
      title: "A review of Springbank 12 Cask Strength",
      publishedAt: "2026-07-22T00:00:00.000Z",
    },
    reviewerName: "A. Critic",
    nativeScore: {
      value: 7.8,
      scale: 10,
      display: "7.8/10",
    },
    summary: "A balanced whisky with coastal smoke and a long finish.",
    bottle: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("BottleReviews", () => {
  it("renders complete reviews from multiple publishers", () => {
    const results = [
      makeExternalReview(),
      makeExternalReview({
        id: 2,
        site: {
          ...makeExternalReview().site!,
          id: 3,
          name: "Dramface",
        },
        reviewerName: "B. Critic",
        nativeScore: { value: 8, scale: 10, display: "8/10" },
        summary: "Rich fruit and oak lead into a dry finish.",
      }),
    ];

    const html = renderToStaticMarkup(<ExternalReviewList results={results} />);

    expect(html).toContain("External reviews");
    expect(html).toContain("Whisky Advocate");
    expect(html).toContain("Dramface");
    expect(html).toContain("By A. Critic");
    expect(html).toContain("Jul 22, 2026");
    expect(html).toContain("7.8/10");
    expect(html).toContain("Peated summary of Whisky Advocate:");
    expect(html).toContain("Read the full review on Whisky Advocate");
    expect(html).toContain('href="https://example.com/reviews/springbank"');
    expect(html).not.toContain("94 points");
  });

  it("renders no empty review section when the Bottle has no reviews", () => {
    expect(renderToStaticMarkup(<ExternalReviewList results={[]} />)).toBe("");
  });

  it("adds the shared band label to an external 100-point score", () => {
    const html = renderToStaticMarkup(
      <ExternalReviewList
        results={[
          makeExternalReview({
            nativeScore: { value: 92, scale: 100, display: "92/100" },
          }),
        ]}
      />,
    );

    expect(html).toContain("92/100");
    expect(html).toContain("Outstanding");
  });

  it("omits missing metadata and old converted scores", () => {
    const results = [
      makeExternalReview({
        reviewerName: null,
        article: { title: null, publishedAt: null },
        nativeScore: null,
        summary: null,
      }),
      makeExternalReview({ id: 2, site: undefined }),
    ];

    const html = renderToStaticMarkup(<ExternalReviewList results={results} />);

    expect(html).toContain("Whisky Advocate");
    expect(html).toContain("Read the full review on Whisky Advocate");
    expect(html).not.toContain("points");
    expect(html).not.toContain("A. Critic");
    expect(html).not.toContain("Peated summary");
    expect(html).not.toContain("<time");
    expect(html).not.toContain(">undefined<");
  });
});
