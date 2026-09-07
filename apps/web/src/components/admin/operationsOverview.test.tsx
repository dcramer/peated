import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OperationsOverview from "./operationsOverview.stylex";

const operations = {
  generatedAt: "2026-09-06T18:00:00.000Z",
  counts: {
    processing: 4,
    waiting: 12,
    failed: 2,
    clearedToday: 86,
  },
  listingAutomation: {
    sampleSize: 100,
    automatic: 73,
    manual: 24,
    failed: 3,
    rate: 73,
    byProposalType: [
      {
        proposalType: "match_existing" as const,
        sampleSize: 72,
        automatic: 65,
        manual: 6,
        failed: 1,
        rate: 90,
      },
      {
        proposalType: "create_new" as const,
        sampleSize: 28,
        automatic: 8,
        manual: 18,
        failed: 2,
        rate: 29,
      },
    ],
  },
  needsAttention: [],
  recentRuns: [],
};

describe("OperationsOverview", () => {
  it("distinguishes unknown, new, and matched Bottles", () => {
    const html = renderToStaticMarkup(
      <OperationsOverview
        bottleResolution={{ unknown: 8, created: 6, matched: 75 }}
        data={operations}
      />,
    );

    expect(html).toContain("Bottle resolution");
    expect(html).toContain("Unknown");
    expect(html).toContain("New bottles");
    expect(html).toContain("Existing matches");
    expect(html).toContain("73% automatic");
    expect(html).toContain("Price matching by decision");
    expect(html).toContain("Existing matches");
    expect(html).toContain("90% · 72 checked");
    expect(html).toContain("New Bottles");
    expect(html).toContain("29% · 28 checked");
    expect(html).toContain("View work");
  });

  it("uses a compact empty state when there are no new source items", () => {
    const html = renderToStaticMarkup(
      <OperationsOverview
        bottleResolution={{ unknown: 0, created: 0, matched: 0 }}
        data={operations}
      />,
    );

    expect(html).toContain("No new reviews or prices in the last 30 days.");
    expect(html).not.toContain("no Bottle match yet");
  });
});
