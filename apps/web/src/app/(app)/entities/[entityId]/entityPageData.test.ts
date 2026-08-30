import { describe, expect, it } from "vitest";

import { getEntityCurrentHref, getEntityTabs } from "./entityPageData";

describe("getEntityTabs", () => {
  it("uses the canonical public Entity route", () => {
    expect(
      getEntityTabs({
        id: 4263,
        kind: "bottler",
        shortName: "SMWS",
        totalBottles: 1_301,
        totalTastings: 29,
      }),
    ).toEqual([
      { href: "/bottlers/4263", label: "Overview" },
      { count: 1_301, href: "/bottlers/4263/bottles", label: "Bottles" },
      { count: 29, href: "/bottlers/4263/tastings", label: "Tastings" },
      { href: "/bottlers/4263/codes", label: "Distillery codes" },
    ]);
  });
});

describe("getEntityCurrentHref", () => {
  it("maps a Peated ID route to the canonical public route", () => {
    expect(
      getEntityCurrentHref(
        { id: 4263, kind: "bottler", peatedId: "E4263" },
        "/E4263",
      ),
    ).toBe("/bottlers/4263");
  });
});
