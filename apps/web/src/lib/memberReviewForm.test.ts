import { describe, expect, it } from "vitest";

import {
  buildMemberReviewFormSubmission,
  MemberReviewFormFieldsSchema,
} from "./memberReviewForm";

describe("member review form submissions", () => {
  it("accepts whole-number scores from 0 through 100", () => {
    expect(
      MemberReviewFormFieldsSchema.safeParse({ score: 0, notes: null }).success,
    ).toBe(true);
    expect(
      MemberReviewFormFieldsSchema.safeParse({ score: 100, notes: "Peat." })
        .success,
    ).toBe(true);
  });

  it("rejects missing, fractional, and out-of-range scores", () => {
    expect(
      MemberReviewFormFieldsSchema.safeParse({ score: null, notes: null })
        .success,
    ).toBe(false);
    expect(
      MemberReviewFormFieldsSchema.safeParse({ score: 89.5, notes: null })
        .success,
    ).toBe(false);
    expect(
      MemberReviewFormFieldsSchema.safeParse({ score: 101, notes: null })
        .success,
    ).toBe(false);
  });

  it("builds the member-review upsert payload for one Bottle", () => {
    expect(
      buildMemberReviewFormSubmission({
        bottleId: 12,
        fields: {
          score: 91,
          tags: ["coastal", "wax"],
          color: 8,
          notes: "Coastal and waxy.",
          servingStyle: "neat",
          friends: [34],
        },
        image: null,
      }),
    ).toEqual({
      bottle: 12,
      score: 91,
      tags: ["coastal", "wax"],
      color: 8,
      notes: "Coastal and waxy.",
      servingStyle: "neat",
      friends: [34],
      image: null,
    });
  });
});
