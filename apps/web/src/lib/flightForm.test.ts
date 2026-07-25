import type { Bottle } from "@peated/server/types";
import { describe, expect, it } from "vitest";

import {
  bottleToFlightOption,
  flightMembershipChanged,
  getFlightBottleIds,
} from "./flightForm";

const bottle = {
  id: 7,
  fullName: "Springbank 12 Batch 24",
} as Bottle;
const relatedBottle = {
  id: 8,
  fullName: "Springbank 12 Batch 25",
} as Bottle;

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
