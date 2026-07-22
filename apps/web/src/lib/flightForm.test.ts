import type { CatalogTargetV1 } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";

import {
  flightMembershipChanged,
  getFlightTargetIds,
  getFlightTargetScopeLabel,
  targetToFlightOption,
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
  it("carries exact and generic identity by target id", () => {
    expect(getFlightTargetIds([exact, generic])).toEqual([21, 22]);
    expect(targetToFlightOption(exact)).toEqual({
      id: 21,
      kind: "bottle",
      name: "Springbank 12 Batch 24",
    });
    expect(targetToFlightOption(generic)).toEqual({
      id: 22,
      kind: "group",
      name: "Springbank 12",
    });
  });

  it("labels exactness without reinterpreting generic identity", () => {
    expect(getFlightTargetScopeLabel("bottle")).toBe("Exact bottle");
    expect(getFlightTargetScopeLabel("group")).toBe(
      "Exact bottle not specified",
    );
  });

  it("compares authoritative target membership independent of ordering", () => {
    expect(flightMembershipChanged([21, 22], [22, 21])).toBe(false);
    expect(flightMembershipChanged([21, 22], [21])).toBe(true);
    expect(flightMembershipChanged([], [21])).toBe(true);
  });
});
