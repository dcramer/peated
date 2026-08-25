import { describe, expect, test } from "vitest";
import { getInitialRatingSystem } from "./ratings";

describe("getInitialRatingSystem", () => {
  test("defaults new tastings to simple", () => {
    expect(getInitialRatingSystem({})).toBe("simple");
  });

  test("uses the account preference for an unrated tasting", () => {
    expect(getInitialRatingSystem({ preference: "advanced" })).toBe("advanced");
  });

  test("uses an existing simple rating before the account preference", () => {
    expect(getInitialRatingSystem({ rating: -1, preference: "advanced" })).toBe(
      "simple",
    );
  });

  test("uses an existing score before the account preference", () => {
    expect(getInitialRatingSystem({ score: 0, preference: "simple" })).toBe(
      "advanced",
    );
  });
});
