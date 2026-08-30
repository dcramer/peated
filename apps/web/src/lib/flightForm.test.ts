import { describe, expect, it } from "vitest";

import {
  bottleToFlightOption,
  flightMembershipChanged,
  getFlightBottleIds,
} from "./flightForm";

const bottle = {
  brand: { name: "Springbank" },
  id: 7,
  name: "12 Batch 24",
};
const relatedBottle = {
  brand: { name: "Springbank" },
  id: 8,
  name: "12 Batch 25",
};

describe("flight form membership", () => {
  it("carries independently complete Bottle identity by Bottle id", () => {
    expect(getFlightBottleIds([bottle, relatedBottle])).toEqual([7, 8]);
    expect(bottleToFlightOption(bottle)).toEqual({
      id: 7,
      name: "Springbank 12 Batch 24",
    });
  });

  it("compares Bottle membership independent of ordering", () => {
    expect(flightMembershipChanged([7, 8], [8, 7])).toBe(false);
    expect(flightMembershipChanged([7, 8], [7])).toBe(true);
    expect(flightMembershipChanged([], [7])).toBe(true);
  });
});
