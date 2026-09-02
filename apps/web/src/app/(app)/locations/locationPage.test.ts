import { describe, expect, test } from "vitest";

import {
  getCountryLocationTabs,
  getLocationCategoryItems,
  getRegionLocationTabs,
} from "./locationPage";

describe("locationPage", () => {
  test("builds stable country and region sections", () => {
    expect(
      getCountryLocationTabs({
        rootHref: "/locations/scotland",
        totalBottles: 12,
        totalDistillers: 3,
      }),
    ).toEqual([
      { href: "/locations/scotland", label: "Overview" },
      { count: 12, href: "/locations/scotland/bottles", label: "Bottles" },
      {
        count: 3,
        href: "/locations/scotland/distillers",
        label: "Distillers",
      },
      { href: "/locations/scotland/regions", label: "Regions" },
    ]);
    expect(
      getRegionLocationTabs({
        rootHref: "/locations/scotland/regions/islay",
        totalBottles: 4,
        totalDistillers: 2,
      }),
    ).toHaveLength(3);
  });

  test("omits missing and zero category sections", () => {
    expect(
      getLocationCategoryItems([
        { category: "single_malt", count: 8 },
        { category: null, count: 2 },
        { category: "blend", count: 0 },
      ]),
    ).toEqual([{ count: 8, label: "Single Malt" }]);
    expect(getLocationCategoryItems([])).toEqual([]);
  });
});
