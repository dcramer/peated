import { describe, expect, it } from "vitest";
import { parseCatalogRouteId } from "./catalogRoute";

describe("public catalog route identifiers", () => {
  it.each([
    ["123", 123],
    ["123-lagavulin-16-year-old", 123],
    ["123-東京", 123],
  ])("parses %s by its numeric ID", (value, expected) => {
    expect(parseCatalogRouteId(value)).toBe(expected);
  });

  it.each(["0", "0123-name", "123-", "name", "9007199254740992-name"])(
    "rejects malformed identifier %s",
    (value) => {
      expect(() => parseCatalogRouteId(value)).toThrow();
    },
  );
});
