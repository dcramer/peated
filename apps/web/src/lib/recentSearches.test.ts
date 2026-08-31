import { describe, expect, it } from "vitest";

import { addRecentSearch, parseRecentSearches } from "./recentSearches";

describe("addRecentSearch", () => {
  it("puts the newest search first and keeps 3 searches", () => {
    expect(
      addRecentSearch(["Ardbeg", "Lagavulin", "Cadenhead's"], "Laphroaig"),
    ).toEqual(["Laphroaig", "Ardbeg", "Lagavulin"]);
  });

  it("normalizes whitespace and moves a repeated search to the front", () => {
    expect(
      addRecentSearch(["Ardbeg 10", "Lagavulin"], "  ardbeg   10 "),
    ).toEqual(["ardbeg 10", "Lagavulin"]);
  });

  it("does not record an empty search", () => {
    expect(addRecentSearch(["Ardbeg"], "   ")).toEqual(["Ardbeg"]);
  });
});

describe("parseRecentSearches", () => {
  it("rejects malformed browser storage", () => {
    expect(parseRecentSearches("not json")).toEqual([]);
    expect(parseRecentSearches('{"query":"Ardbeg"}')).toEqual([]);
  });

  it("keeps the newest 3 valid stored searches", () => {
    expect(
      parseRecentSearches(
        JSON.stringify([" Ardbeg ", "ardbeg", "Lagavulin", "", "Macallan"]),
      ),
    ).toEqual(["Ardbeg", "Lagavulin", "Macallan"]);
  });
});
