import { describe, expect, it } from "vitest";

import { type BottleTabsBottle, getBottleTabs } from "./bottleTabs";

function bottleWithReleaseCount(totalBottles: number): BottleTabsBottle {
  return {
    id: 42,
    totalTastings: 3,
    group: { totalBottles },
  };
}

describe("BottleTabs", () => {
  it("shows Releases instead of Similar for a release family", () => {
    const tabs = getBottleTabs(bottleWithReleaseCount(2));
    const releases = tabs.find((tab) => tab.href.endsWith("/releases"));

    expect(releases).toEqual({
      href: "/bottles/42/releases",
      label: "Releases (2)",
    });
    expect(tabs.some((tab) => tab.href.includes("/similar"))).toBe(false);
  });

  it("hides the Releases tab for a singleton Bottle", () => {
    const tabs = getBottleTabs(bottleWithReleaseCount(1));

    expect(tabs.some((tab) => tab.href.includes("/releases"))).toBe(false);
    expect(tabs.some((tab) => tab.href.includes("/similar"))).toBe(false);
  });
});
