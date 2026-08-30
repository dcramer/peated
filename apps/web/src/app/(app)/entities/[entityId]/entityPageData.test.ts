import { describe, expect, it } from "vitest";

import {
  entityHasBottleCatalog,
  getEntityClassification,
  getEntityCurrentHref,
  getEntityOwnerLabel,
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
  it("uses the entity kind, establishment term, and most specific location", () => {
    expect(
      getEntityClassification({
        country: { name: "Scotland" },
        kind: "distillery",
        region: { name: "Islay" },
        yearEstablished: 1816,
      }),
    ).toBe("Distillery · founded 1816 · Islay");
  });
});

describe("getEntityOwnerLabel", () => {
  it("describes a brand through its owner", () => {
    expect(
      getEntityOwnerLabel(
        { kind: "brand" },
        { name: "Diageo plc", shortName: "Diageo" },
      ),
    ).toBe("A Diageo brand");
  });

  it("describes other entity kinds as part of their owner", () => {
    expect(
      getEntityOwnerLabel(
        { kind: "distillery" },
        { name: "Diageo", shortName: null },
      ),
    ).toBe("Part of Diageo");
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
