import type { CatalogTargetV1 } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";

import {
  canEditFlightMembership,
  flightMembershipChanged,
  getFlightExactBottleIds,
} from "./flightForm";

const exact = {
  kind: "bottle",
  targetId: 21,
  bottle: { id: 7, fullName: "Springbank 12 Batch 24" },
  group: { id: 3, fullName: "Springbank 12" },
} as CatalogTargetV1;
const generic = {
  kind: "group",
  targetId: 22,
  group: { id: 3, fullName: "Springbank 12" },
} as CatalogTargetV1;

describe("flight form membership", () => {
  it("uses independently complete exact Bottles for staged editing", () => {
    expect(getFlightExactBottleIds([exact])).toEqual([7]);
    expect(canEditFlightMembership([exact])).toBe(true);
  });

  it("does not reinterpret generic identity as a representative Bottle", () => {
    expect(getFlightExactBottleIds([generic, exact])).toEqual([7]);
    expect(canEditFlightMembership([generic, exact])).toBe(false);
  });

  it("preserves membership when only ordering changes", () => {
    expect(flightMembershipChanged([7, 8], [8, 7])).toBe(false);
    expect(flightMembershipChanged([7, 8], [7])).toBe(true);
    expect(flightMembershipChanged([], [7])).toBe(true);
  });
});
