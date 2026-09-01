import { describe, expect, it } from "vitest";

import {
  entityHasBottleCatalog,
  getDistilleryBottleView,
  getEntityClassification,
  getEntityCurrentHref,
  getEntityRelationshipOwnerIds,
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

describe("getEntityRelationshipOwnerIds", () => {
  it("keeps a company's operated entities separate from its siblings", () => {
    expect(
      getEntityRelationshipOwnerIds({
        id: 10,
        kind: "company",
        ownerId: 42,
      }),
    ).toEqual({
      operatedOwnerId: 10,
      siblingOwnerId: 42,
    });
  });
});

describe("getEntityTabs", () => {
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
