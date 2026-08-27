import { describe, expect, it } from "vitest";
import { resolvePeatedIdRoute } from "./peatedIdRoutes";

describe("Peated ID routes", () => {
  it("redirects Bottle IDs to the canonical Bottle collection route", () => {
    expect(resolvePeatedIdRoute("/B0123")).toEqual({
      action: "redirect",
      pathname: "/bottles/123",
    });
    expect(resolvePeatedIdRoute("/b123")).toEqual({
      action: "redirect",
      pathname: "/bottles/123",
    });
  });

  it("rewrites Entity IDs so the Entity page can select its primary kind", () => {
    expect(resolvePeatedIdRoute("/E0456")).toEqual({
      action: "rewrite",
      pathname: "/entities/456",
    });
    expect(resolvePeatedIdRoute("/e456/")).toEqual({
      action: "rewrite",
      pathname: "/entities/456",
    });
  });

  it("rewrites primary-kind Entity routes to the existing page tree", () => {
    expect(resolvePeatedIdRoute("/distillers/456")).toEqual({
      action: "rewrite",
      pathname: "/entities/456",
    });
    expect(resolvePeatedIdRoute("/companies/456/edit")).toEqual({
      action: "rewrite",
      pathname: "/entities/456/edit",
    });
  });

  it("does not claim canonical Bottle, internal Entity, or collection routes", () => {
    expect(resolvePeatedIdRoute("/bottles")).toBeNull();
    expect(resolvePeatedIdRoute("/bottles/123")).toBeNull();
    expect(resolvePeatedIdRoute("/bottles/123/edit")).toBeNull();
    expect(resolvePeatedIdRoute("/entities/456")).toBeNull();
    expect(resolvePeatedIdRoute("/entities/456/aliases")).toBeNull();
    expect(resolvePeatedIdRoute("/distillers")).toBeNull();
    expect(resolvePeatedIdRoute("/B0")).toBeNull();
    expect(resolvePeatedIdRoute("/B0000")).toBeNull();
    expect(resolvePeatedIdRoute("/T123")).toBeNull();
  });
});
