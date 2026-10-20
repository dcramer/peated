import { describe, expect, test } from "vitest";
import { reviewAssignment } from "./reviewTask";

describe("reviewAssignment", () => {
  const item = {
    review: { id: 18876, name: "Glenfarclas 1979/2014", bottle: null },
    attemptedAt: "2026-10-16T18:45:00.000Z",
  } satisfies Parameters<typeof reviewAssignment>[0];
  test("carries the observed review version without accepting a reusable name", () => {
    expect(reviewAssignment(item, 42)).toEqual({
      externalReview: 18876,
      bottle: 42,
      expectedResolution: {
        name: item.review.name,
        attemptedAt: item.attemptedAt,
      },
    });
  });
  test("does not assign a review before its first unresolved attempt completes", () => {
    expect(() => reviewAssignment({ ...item, attemptedAt: null }, 42)).toThrow(
      "no longer waiting",
    );
  });
});
