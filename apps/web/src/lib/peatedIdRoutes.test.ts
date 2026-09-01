import { describe, expect, it } from "vitest";
import {
  matchEntityRoute,
  resolveBottlePeatedIdRoute,
  resolveEntityRoute,
} from "./peatedIdRoutes";

describe("Peated ID routes", () => {
  it("redirects Bottle IDs to the Bottle collection route", () => {
    expect(resolveBottlePeatedIdRoute("/B0123")).toEqual({
      action: "redirect",
      pathname: "/bottles/123",
    });
    expect(resolveBottlePeatedIdRoute("/b123")).toEqual({
      action: "redirect",
      pathname: "/bottles/123",
    });
  });

  it("matches every route that can address an Entity", () => {
    expect(matchEntityRoute("/E0456")).toEqual({
      entityId: 456,
      kind: null,
      pathname: "/E0456",
      source: "peated-id",
      suffix: "",
    });
    expect(matchEntityRoute("/distillers/456-lagavulin")).toEqual({
      entityId: 456,
      kind: "distillery",
      pathname: "/distillers/456-lagavulin",
      source: "collection",
      suffix: "",
    });
    expect(matchEntityRoute("/companies/456-diageo/edit")).toEqual({
      entityId: 456,
      kind: "company",
      pathname: "/companies/456-diageo",
      source: "collection",
      suffix: "/edit",
    });
    expect(matchEntityRoute("/entities/456-old-name/aliases")).toEqual({
      entityId: 456,
      kind: null,
      pathname: "/entities/456-old-name",
      source: "legacy",
      suffix: "/aliases",
    });
  });

  it("rewrites a canonical Entity route to the page tree", () => {
    const match = matchEntityRoute("/companies/456-diageo/edit");
    expect(match).not.toBeNull();
    expect(
      resolveEntityRoute(match!, {
        id: 456,
        kind: "company",
        name: "Diageo",
      }),
    ).toEqual({
      action: "rewrite",
      pathname: "/entities/456/edit",
    });
  });

  it.each([
    ["/E0456", 456, "company", "Diageo", "/companies/456-diageo"],
    ["/entities/456", 456, "company", "Diageo", "/companies/456-diageo"],
    ["/companies/456", 456, "company", "Diageo", "/companies/456-diageo"],
    [
      "/brands/456-old-name/bottles",
      456,
      "company",
      "Diageo",
      "/companies/456-diageo/bottles",
    ],
    [
      "/entities/12-old-name/edit",
      34,
      "distillery",
      "東京",
      "/distillers/34-東京/edit",
    ],
  ] as const)(
    "redirects %s to its canonical Entity route",
    (pathname, id, kind, name, expected) => {
      const match = matchEntityRoute(pathname);
      expect(match).not.toBeNull();
      expect(resolveEntityRoute(match!, { id, kind, name })).toEqual({
        action: "redirect",
        pathname: expected,
      });
    },
  );

  it("does not claim unrelated or malformed routes", () => {
    expect(resolveBottlePeatedIdRoute("/bottles/123")).toBeNull();
    expect(matchEntityRoute("/bottles/123")).toBeNull();
    expect(matchEntityRoute("/distillers")).toBeNull();
    expect(matchEntityRoute("/entities/0")).toBeNull();
    expect(matchEntityRoute("/entities/9007199254740992")).toBeNull();
    expect(matchEntityRoute("/companies/9007199254740992")).toBeNull();
    expect(matchEntityRoute("/B0000")).toBeNull();
    expect(matchEntityRoute("/T123")).toBeNull();
  });
});
