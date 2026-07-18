import { getIncomingBottleDecisionFromResolutionSource } from "@peated/server/lib/incomingBottleDecisionLog";
import { describe, expect, test } from "vitest";

describe("getIncomingBottleDecisionFromResolutionSource", () => {
  test("uses concrete vocabulary from required creation state", () => {
    for (const source of [
      "classifier_create_bottle",
      "classifier_create_release",
      "classifier_create_bottle_and_release",
      "classifier_repair_parent_and_create_release",
    ]) {
      expect(
        getIncomingBottleDecisionFromResolutionSource(source, {
          createdBottle: true,
        }),
      ).toBe("create_bottle");
      expect(
        getIncomingBottleDecisionFromResolutionSource(source, {
          createdBottle: false,
        }),
      ).toBe("match_existing");
    }
  });
});
