import { getIncomingBottleDecisionFromResolutionSource } from "@peated/server/lib/incomingBottleDecisionLog";
import { describe, expect, test } from "vitest";

describe("getIncomingBottleDecisionFromResolutionSource", () => {
  test("uses concrete vocabulary only for supported resolution sources", () => {
    expect(
      getIncomingBottleDecisionFromResolutionSource(
        "classifier_create_bottle",
        { createdBottle: true },
      ),
    ).toBe("create_bottle");
    expect(
      getIncomingBottleDecisionFromResolutionSource(
        "classifier_create_bottle",
        { createdBottle: false },
      ),
    ).toBe("match_existing");

    for (const obsoleteSource of [
      "classifier_create_release",
      "classifier_create_bottle_and_release",
      "classifier_repair_parent_and_create_release",
    ]) {
      expect(
        getIncomingBottleDecisionFromResolutionSource(obsoleteSource, {
          createdBottle: true,
        }),
      ).toBeNull();
      expect(
        getIncomingBottleDecisionFromResolutionSource(obsoleteSource, {
          createdBottle: false,
        }),
      ).toBeNull();
    }
  });
});
