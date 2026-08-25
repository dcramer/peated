import { describe, expect, it } from "vitest";
import { resolvePeatedIdRoute } from "./peatedIdRoutes";

describe("Peated ID routes", () => {
  it("rewrites canonical Peated ID paths to existing detail routes", () => {
    expect(resolvePeatedIdRoute("/B000123")).toEqual({
      action: "rewrite",
      pathname: "/bottles/123",
    });
    expect(resolvePeatedIdRoute("/E000456")).toEqual({
      action: "rewrite",
      pathname: "/entities/456",
    });
  });

  it("redirects short, lowercase, and trailing-slash IDs", () => {
    expect(resolvePeatedIdRoute("/b123")).toEqual({
      action: "redirect",
      pathname: "/B000123",
    });
    expect(resolvePeatedIdRoute("/B123")).toEqual({
      action: "redirect",
      pathname: "/B000123",
    });
    expect(resolvePeatedIdRoute("/E000456/")).toEqual({
      action: "redirect",
      pathname: "/E000456",
    });
  });

  it("redirects exact legacy detail paths", () => {
    expect(resolvePeatedIdRoute("/bottles/123")).toEqual({
      action: "redirect",
      pathname: "/B000123",
    });
    expect(resolvePeatedIdRoute("/entities/456")).toEqual({
      action: "redirect",
      pathname: "/E000456",
    });
  });

  it("does not claim collections, nested routes, or unsupported IDs", () => {
    expect(resolvePeatedIdRoute("/bottles")).toBeNull();
    expect(resolvePeatedIdRoute("/bottles/123/edit")).toBeNull();
    expect(resolvePeatedIdRoute("/entities/456/aliases")).toBeNull();
    expect(resolvePeatedIdRoute("/B0")).toBeNull();
    expect(resolvePeatedIdRoute("/B000000")).toBeNull();
    expect(resolvePeatedIdRoute("/T123")).toBeNull();
  });
});
