import { describe, expect, test } from "vitest";
import { buildReviewNormalizationUpdate } from "./reviews";

describe("buildReviewNormalizationUpdate", () => {
  test("includes a discovered Bottle assignment", () => {
    expect(buildReviewNormalizationUpdate("Normalized review", 42)).toEqual({
      name: "Normalized review",
      bottleId: 42,
    });
  });

  test("omits an unresolved Bottle assignment", () => {
    expect(buildReviewNormalizationUpdate("Normalized review", null)).toEqual({
      name: "Normalized review",
    });
  });
});
