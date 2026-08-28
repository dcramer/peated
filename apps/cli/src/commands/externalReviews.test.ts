import { describe, expect, test } from "vitest";
import { buildExternalReviewNameUpdate } from "./externalReviews";

describe("buildExternalReviewNameUpdate", () => {
  test("includes a discovered Bottle assignment", () => {
    expect(buildExternalReviewNameUpdate("Normalized review", 42)).toEqual({
      name: "Normalized review",
      bottleId: 42,
    });
  });

  test("omits an unresolved Bottle assignment", () => {
    expect(buildExternalReviewNameUpdate("Normalized review", null)).toEqual({
      name: "Normalized review",
    });
  });
});
