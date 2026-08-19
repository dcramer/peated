import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BottleReviews from "./bottleReviews";

const mocks = vi.hoisted(() => ({
  queryOptions: vi.fn((options) => options),
  useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: mocks.useSuspenseQuery,
}));

vi.mock("../lib/orpc/context", () => ({
  useORPC: () => ({
    reviews: {
      list: {
        queryOptions: mocks.queryOptions,
      },
    },
  }),
}));

type ReviewListItem = Outputs["reviews"]["list"]["results"][number];

const timestamp = "2026-07-22T12:00:00.000Z";

function makeReview(overrides: Partial<ReviewListItem> = {}): ReviewListItem {
  return {
    id: 1,
    name: "Springbank 12 Cask Strength",
    rating: 94,
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
  beforeEach(() => {
    mocks.queryOptions.mockClear();
    mocks.useSuspenseQuery.mockReset();
  });

  it("renders complete reviews from multiple publishers", () => {
    mocks.useSuspenseQuery.mockReturnValue({
      data: {
        results: [
          makeReview(),
          makeReview({
            id: 2,
            site: {
              ...makeReview().site!,
              id: 3,
              name: "Dramface",
            },
            reviewerName: "B. Critic",
            nativeScore: { value: 8, scale: 10, display: "8/10" },
            summary: "Rich fruit and oak lead into a dry finish.",
          }),
        ],
      },
    });

    const html = renderToStaticMarkup(<BottleReviews bottleId={42} />);

    expect(mocks.queryOptions).toHaveBeenCalledWith({
      input: { bottle: 42 },
    });
    expect(html).toContain("The Critics");
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
    mocks.useSuspenseQuery.mockReturnValue({
      data: { results: [] },
    });

    expect(renderToStaticMarkup(<BottleReviews bottleId={42} />)).toBe("");
  });

  it("omits missing metadata and normalized compatibility ratings", () => {
    mocks.useSuspenseQuery.mockReturnValue({
      data: {
        results: [
          makeReview({
            reviewerName: null,
            article: { title: null, publishedAt: null },
            nativeScore: null,
            summary: null,
          }),
          makeReview({ id: 2, site: undefined }),
        ],
      },
    });

    const html = renderToStaticMarkup(<BottleReviews bottleId={42} />);

    expect(html).toContain("Whisky Advocate");
    expect(html).toContain("Read the full review on Whisky Advocate");
    expect(html).not.toContain("points");
    expect(html).not.toContain("A. Critic");
    expect(html).not.toContain("Peated summary");
    expect(html).not.toContain("<time");
    expect(html).not.toContain(">undefined<");
  });
});
