import { describe, expect, test } from "vitest";

import { getEventRegionPageState } from "./eventRegionData";

const events = [
  { country: { slug: "scotland" }, name: "Edinburgh" },
  { country: { slug: "united-states" }, name: "Kentucky" },
  { country: { slug: "japan" }, name: "Tokyo" },
  { country: { slug: "scotland" }, name: "Glasgow" },
  { country: null, name: "Online" },
  { country: { slug: "unmapped-country" }, name: "Unknown" },
];

describe("event region page state", () => {
  test("groups upcoming events into represented world regions", () => {
    const state = getEventRegionPageState(events, undefined);

    expect(state.options).toEqual([
      { count: 1, label: "Americas", slug: "americas" },
      { count: 2, label: "Europe", slug: "europe" },
      { count: 1, label: "Asia", slug: "asia" },
    ]);
    expect(state.results).toEqual(events);
    expect(state.selectedRegion).toBeNull();
  });

  test("filters events for a selected region", () => {
    const state = getEventRegionPageState(events, "europe");

    expect(state.results.map((event) => event.name)).toEqual([
      "Edinburgh",
      "Glasgow",
    ]);
    expect(state.selectedRegion).toEqual({
      label: "Europe",
      slug: "europe",
    });
  });

  test("keeps a selected empty region available to clear", () => {
    const state = getEventRegionPageState(events, "africa");

    expect(state.options.at(-1)).toEqual({
      count: 0,
      label: "Africa",
      slug: "africa",
    });
    expect(state.results).toEqual([]);
  });

  test("ignores unknown or repeated region parameters", () => {
    expect(getEventRegionPageState(events, "unknown").results).toEqual(events);
    expect(getEventRegionPageState(events, ["europe", "asia"]).results).toEqual(
      events,
    );
  });
});
