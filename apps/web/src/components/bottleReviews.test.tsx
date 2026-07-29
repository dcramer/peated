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

  it("loads reviews by direct Bottle id and preserves critic presentation", () => {
    mocks.useSuspenseQuery.mockReturnValue({
      data: {
        results: [makeReview(), makeReview({ id: 2, site: undefined })],
      },
    });

    const html = renderToStaticMarkup(<BottleReviews bottleId={42} />);

    expect(mocks.queryOptions).toHaveBeenCalledWith({
      input: { bottle: 42 },
    });
    expect(html).toContain("The Critics");
    expect(html).toContain("Whisky Advocate");
    expect(html).toContain("94 points");
    expect(html).toContain('href="https://example.com/reviews/springbank"');
    expect(html).not.toContain(">undefined<");
  });

  it("renders no empty review section when the Bottle has no reviews", () => {
    mocks.useSuspenseQuery.mockReturnValue({
      data: { results: [] },
    });

    expect(renderToStaticMarkup(<BottleReviews bottleId={42} />)).toBe("");
  });
});
