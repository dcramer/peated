import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LibraryInsightsContent } from "./libraryInsights";

type LibraryStats = Outputs["users"]["libraryStats"];

function makeStats(overrides: Partial<LibraryStats> = {}): LibraryStats {
  return {
    total: 4,
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
  test("shows distilleries and age distribution with enough age data", () => {
    const html = renderToStaticMarkup(
      <LibraryInsightsContent stats={makeStats()} username="collector" />,
    );

    expect(html).toContain("Top distilleries");
    expect(html).toContain("Example Distillery");
    expect(html).toContain("Example Distillery: 3 bottles");
    expect(html).toContain("Age profile");
    expect(html).toContain("Median 12 yr");
    expect(html).toContain("Under 10: 1 bottle");
    expect(html).toContain("Age stated for 3 of 4 bottles");
    expect(html).not.toContain("Library types");
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
