import { describe, expect, it } from "vitest";
import { selectOtherSeriesBottles } from "./seriesBottleRail";

describe("Series bottle rail", () => {
  it("excludes the current Bottle and keeps at most three siblings", () => {
    const bottles = [1, 2, 3, 4, 5].map((id) => ({ id }));

    expect(selectOtherSeriesBottles(bottles, 2)).toEqual([
      { id: 1 },
      { id: 3 },
      { id: 4 },
    ]);
  });

  it("returns no siblings for a one-Bottle Series", () => {
    expect(selectOtherSeriesBottles([{ id: 2 }], 2)).toEqual([]);
  });
});
