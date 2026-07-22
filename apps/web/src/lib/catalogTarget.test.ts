import type { CatalogTargetV1 } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";

import {
  getCatalogTargetHref,
  getCatalogTargetLabel,
  getCatalogTargetStats,
} from "./catalogTarget";

const group = {
  id: 8,
  fullName: "Macallan 18",
  totalTastings: 3,
  avgRating: 1.5,
  statedAge: 18,
};

describe("catalog target display helpers", () => {
  it("uses the exact Bottle as the linked identity", () => {
    const target = {
      kind: "bottle",
      targetId: 20,
      group,
      bottle: {
        id: 9,
        fullName: "Macallan 18 2024 Release",
        totalTastings: 1,
        avgRating: 2,
        statedAge: 18,
      },
    } as CatalogTargetV1;

    expect(getCatalogTargetLabel(target)).toBe("Macallan 18 2024 Release");
    expect(getCatalogTargetHref(target)).toBe("/bottles/9");
    expect(getCatalogTargetStats(target)).toEqual({
      totalTastings: 1,
      avgRating: 2,
      statedAge: 18,
    });
  });

  it("uses only the group identity for a generic target", () => {
    const target = {
      kind: "group",
      targetId: 21,
      group,
    } as CatalogTargetV1;

    expect(getCatalogTargetLabel(target)).toBe("Macallan 18");
    expect(getCatalogTargetHref(target)).toBe("/bottle-groups/8");
    expect(getCatalogTargetStats(target)).toEqual({
      totalTastings: 3,
      avgRating: 1.5,
      statedAge: 18,
    });
  });
});
