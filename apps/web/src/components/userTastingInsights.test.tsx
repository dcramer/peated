import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { TastingSnapshotCard } from "./userTastingInsights";

const age = {
  knownCount: 3,
  median: 12,
  oldest: 18,
  buckets: [
    { id: "under10" as const, label: "Under 10", count: 0 },
    { id: "from10To12" as const, label: "10–12", count: 2 },
    { id: "from13To17" as const, label: "13–17", count: 0 },
    { id: "from18To24" as const, label: "18–24", count: 1 },
    { id: "atLeast25" as const, label: "25+", count: 0 },
    { id: "unstated" as const, label: "Unstated", count: 1 },
  ],
};

describe("TastingSnapshotCard", () => {
  test("shows rating mix, exploration, and the most revisited bottle", () => {
    const html = renderToStaticMarkup(
      <TastingSnapshotCard
        stats={{
          total: 10,
          uniqueBottles: 8,
          ratings: { total: 8, pass: 1, sip: 3, savor: 4 },
          mostTastedBottle: { id: 42, name: "Favorite Bottle", count: 3 },
          age,
        }}
      />,
    );

    expect(html).toContain("Tasting snapshot");
    expect(html).toContain("4 (50%)");
    expect(html).toContain("2</span><span");
    expect(html).toContain("repeat pours");
    expect(html).toContain("Favorite Bottle");
    expect(html).toContain("3 times");
    expect(html).toContain('href="/bottles/42"');
  });

  test("handles an unrated one-off tasting", () => {
    const html = renderToStaticMarkup(
      <TastingSnapshotCard
        stats={{
          total: 1,
          uniqueBottles: 1,
          ratings: { total: 0, pass: 0, sip: 0, savor: 0 },
          mostTastedBottle: null,
          age,
        }}
      />,
    );

    expect(html).toContain("No ratings yet");
    expect(html).toContain("0</span><span");
    expect(html).toContain("repeat pours");
    expect(html).not.toContain("Most revisited");
  });
});
