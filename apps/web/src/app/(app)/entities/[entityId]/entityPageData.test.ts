import { describe, expect, it } from "vitest";

import {
  entityHasBottleCatalog,
  getEntityClassification,
  getEntityCurrentHref,
  getEntityTabs,
} from "./entityPageData";

describe("entityHasBottleCatalog", () => {
  it("limits bottle modules to entity kinds that own bottles", () => {
    expect(entityHasBottleCatalog({ kind: "brand" })).toBe(true);
    expect(entityHasBottleCatalog({ kind: "bottler" })).toBe(true);
    expect(entityHasBottleCatalog({ kind: "distillery" })).toBe(true);
    expect(entityHasBottleCatalog({ kind: "company" })).toBe(false);
  });
});

describe("getEntityClassification", () => {
  it("uses the entity kind", () => {
    expect(getEntityClassification({ kind: "distillery" })).toBe("Distillery");
  });
});

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
