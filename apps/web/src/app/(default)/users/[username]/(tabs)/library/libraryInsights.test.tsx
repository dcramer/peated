import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LibraryInsightsContent } from "./libraryInsights";

type LibraryStats = Outputs["users"]["libraryStats"];

function makeStats(overrides: Partial<LibraryStats> = {}): LibraryStats {
  return {
    total: 4,
    status: { open: 2, sealed: 1, unspecified: 1 },
    brands: [{ id: 2, name: "Example Brand", count: 4 }],
    distillers: [{ id: 1, name: "Example Distillery", count: 3 }],
    age: {
      knownCount: 3,
      median: 12,
      oldest: 25,
      buckets: [
        { id: "under10", label: "Under 10", count: 1 },
        { id: "from10To12", label: "10–12", count: 1 },
        { id: "from13To17", label: "13–17", count: 0 },
        { id: "from18To24", label: "18–24", count: 0 },
        { id: "atLeast25", label: "25+", count: 1 },
        { id: "unstated", label: "Unstated", count: 1 },
      ],
    },
    categories: [{ category: "single_malt", count: 3 }],
    ...overrides,
  };
}

describe("LibraryInsightsContent", () => {
  test("shows producers, status, and age distribution with enough age data", () => {
    const html = renderToStaticMarkup(
      <LibraryInsightsContent stats={makeStats()} username="collector" />,
    );

    expect(html).toContain("Most collected");
    expect(html).toContain("Brands");
    expect(html).toContain("Example Brand");
    expect(html).toContain("Example Brand: 4 bottles");
    expect(html).toContain("Distilleries");
    expect(html).toContain("Example Distillery");
    expect(html).toContain("Example Distillery: 3 bottles");
    expect(html).toContain("Bottle ages");
    expect(html).toContain("Median 12 yr");
    expect(html).toContain("Under 10: 1 bottle");
    expect(html).toContain("Age stated for 3 of 4 bottles");
    expect(html).toContain("data-age-profile-chart");
    expect(html).toContain("min-h-28 flex-1");
    expect(html).toContain("Bottle status");
    expect(html).toContain("Open");
    expect(html).toContain("Sealed");
    expect(html).toContain("Not set");
    expect(html).not.toContain("Library types");
  });

  test("keeps each producer group to its top three entries", () => {
    const stats = makeStats({
      brands: [
        { id: 1, name: "First Brand", count: 4 },
        { id: 2, name: "Second Brand", count: 3 },
        { id: 3, name: "Third Brand", count: 2 },
        { id: 4, name: "Fourth Brand", count: 1 },
      ],
      distillers: [],
    });
    const html = renderToStaticMarkup(
      <LibraryInsightsContent stats={stats} username="collector" />,
    );

    expect(html).toContain("First Brand");
    expect(html).toContain("Third Brand");
    expect(html).not.toContain("Fourth Brand");
  });

  test("falls back to category mix when age data is limited", () => {
    const stats = makeStats({
      age: {
        ...makeStats().age,
        knownCount: 2,
      },
    });
    const html = renderToStaticMarkup(
      <LibraryInsightsContent stats={stats} username="collector" />,
    );

    expect(html).toContain("Library types");
    expect(html).toContain("Single Malt");
    expect(html).toContain("Single Malt: 3 bottles");
    expect(html).toContain("Age data is limited");
    expect(html).not.toContain("Age profile");
  });

  test("renders nothing for an empty Library", () => {
    const html = renderToStaticMarkup(
      <LibraryInsightsContent
        stats={makeStats({ total: 0 })}
        username="collector"
      />,
    );

    expect(html).toBe("");
  });
});
