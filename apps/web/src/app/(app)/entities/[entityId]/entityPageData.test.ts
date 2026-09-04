import { describe, expect, it } from "vitest";

import {
  entityHasBottleCatalog,
  getDistilleryBottleView,
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

describe("getDistilleryBottleView", () => {
  it("defaults distillery pages to their releases", () => {
    expect(getDistilleryBottleView({ kind: "distillery" }, undefined)).toBe(
      "releases",
    );
    expect(getDistilleryBottleView({ kind: "distillery" }, "other")).toBe(
      "other",
    );
    expect(getDistilleryBottleView({ kind: "distillery" }, "unknown")).toBe(
      "releases",
    );
    expect(
      getDistilleryBottleView({ kind: "distillery" }, undefined, "other"),
    ).toBe("other");
  });

  it("does not add a view for other kinds", () => {
    expect(getDistilleryBottleView({ kind: "brand" }, "other")).toBe(undefined);
  });
});

describe("getEntityClassification", () => {
  it("uses the entity kind", () => {
    expect(getEntityClassification({ kind: "distillery" })).toBe("Distillery");
  });
});

describe("getEntityTabs", () => {
  it("uses computed Company portfolio and Bottle totals", () => {
    expect(
      getEntityTabs(
        {
          id: 5558,
          kind: "company",
          name: "Diageo",
          shortName: null,
          totalBottles: 10,
          totalTastings: 20,
        },
        { bottles: 400, portfolio: 62 },
      ),
    ).toEqual([
      { href: "/companies/5558-diageo", label: "Overview" },
      {
        href: "/companies/5558-diageo/portfolio",
        label: "Portfolio",
        count: 62,
      },
      {
        href: "/companies/5558-diageo/bottles",
        label: "Bottles",
        count: 400,
      },
    ]);
  });

  it("omits the bottle tab for companies with no bottles", () => {
    expect(
      getEntityTabs(
        {
          id: 5558,
          kind: "company",
          name: "Diageo",
          shortName: null,
          totalBottles: 0,
          totalTastings: 0,
        },
        { bottles: 0, portfolio: 0 },
      ),
    ).toEqual([{ href: "/companies/5558-diageo", label: "Overview" }]);
  });

  it("uses the canonical public Entity route", () => {
    expect(
      getEntityTabs({
        id: 4263,
        kind: "bottler",
        name: "Scotch Malt Whisky Society",
        shortName: "SMWS",
        totalBottles: 1_301,
        totalTastings: 29,
      }),
    ).toEqual([
      {
        href: "/bottlers/4263-scotch-malt-whisky-society",
        label: "Overview",
      },
      {
        count: 1_301,
        href: "/bottlers/4263-scotch-malt-whisky-society/bottles",
        label: "Bottles",
      },
      {
        count: 29,
        href: "/bottlers/4263-scotch-malt-whisky-society/tastings",
        label: "Tastings",
      },
      {
        href: "/bottlers/4263-scotch-malt-whisky-society/codes",
        label: "Distillery codes",
      },
    ]);
  });
});

describe("getEntityCurrentHref", () => {
  it("maps a Peated ID route to the canonical public route", () => {
    expect(
      getEntityCurrentHref(
        {
          id: 4263,
          kind: "bottler",
          name: "Scotch Malt Whisky Society",
          peatedId: "E4263",
        },
        "/E4263",
      ),
    ).toBe("/bottlers/4263-scotch-malt-whisky-society");
  });
});
