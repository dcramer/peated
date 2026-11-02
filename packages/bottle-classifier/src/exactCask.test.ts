import { describe, expect, test } from "vitest";
import { getExactCaskCodeAnchor } from "./exactCask";

describe("exact cask code anchors", () => {
  test("extracts valid exact-cask codes", () => {
    expect(getExactCaskCodeAnchor("SMWS RW6.5 Sauna Smoke 58.1%")).toBe(
      "RW6.5",
    );
    expect(getExactCaskCodeAnchor("SMWS 54.2 Bright orchard fruit")).toBe(
      "54.2",
    );
  });

  test("ignores measurement lookalikes", () => {
    expect(getExactCaskCodeAnchor("SMWS single cask 54.2% ABV")).toBeNull();
    expect(getExactCaskCodeAnchor("SMWS single cask 54.2 ABV")).toBeNull();
    expect(getExactCaskCodeAnchor("SMWS single cask 54.2 proof")).toBeNull();
  });
});
