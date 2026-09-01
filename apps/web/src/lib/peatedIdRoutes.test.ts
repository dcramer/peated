import { describe, expect, it } from "vitest";
import {
  matchEntityRoute,
  resolveBottlePeatedIdRoute,
  resolveEntityRoute,
} from "./peatedIdRoutes";

describe("Peated ID routes", () => {
  it("redirects Bottle IDs to the canonical Bottle collection route", () => {
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
      source: "peated-id",
      suffix: "",
    });
    expect(matchEntityRoute("/distillers/456")).toEqual({
      entityId: 456,
      kind: "distillery",
      source: "collection",
      suffix: "",
    });
    expect(matchEntityRoute("/companies/456/edit")).toEqual({
      entityId: 456,
      kind: "company",
      source: "collection",
      suffix: "/edit",
    });
    expect(matchEntityRoute("/entities/456/aliases")).toEqual({
      entityId: 456,
      kind: null,
      source: "legacy",
      suffix: "/aliases",
    });
  });

  it("rewrites a canonical Entity route to the page tree", () => {
    const match = matchEntityRoute("/companies/456/edit");
    expect(match).not.toBeNull();
    expect(resolveEntityRoute(match!, { id: 456, kind: "company" })).toEqual({
      action: "rewrite",
      pathname: "/entities/456/edit",
    });
  });

  it.each([
    ["/E0456", 456, "company", "/companies/456"],
    ["/entities/456", 456, "company", "/companies/456"],
    ["/brands/456/bottles", 456, "company", "/companies/456/bottles"],
    ["/entities/12/edit", 34, "distillery", "/distillers/34/edit"],
  ] as const)(
    "redirects %s to its canonical Entity route",
    (pathname, id, kind, expected) => {
      const match = matchEntityRoute(pathname);
      expect(match).not.toBeNull();
      expect(resolveEntityRoute(match!, { id, kind })).toEqual({
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
