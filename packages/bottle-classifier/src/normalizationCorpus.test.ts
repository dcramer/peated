import { describe, expect, test } from "vitest";
import { BOTTLE_NORMALIZATION_CORPUS } from "./normalizationCorpus";

describe("bottle normalization corpus", () => {
  test("uses unique example ids", () => {
    const ids = BOTTLE_NORMALIZATION_CORPUS.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps release identity aligned with the expected layer", () => {
    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      const hasReleaseIdentity = example.expectation.releaseIdentity !== null;

      if (example.expectation.classifierExpectation === "bottle_plus_release") {
        expect(hasReleaseIdentity).toBe(true);
        continue;
      }

      expect(hasReleaseIdentity).toBe(false);
    }
  });

  test("reserves classifier-only heuristic cases for classifier-reviewed splits", () => {
    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      if (example.expectation.heuristicExpectation !== "classifier_only") {
        continue;
      }

      expect(example.expectation.classifierExpectation).toBe(
        "bottle_plus_release",
      );
      expect(example.expectation.releaseIdentity).not.toBeNull();
    }
  });
});
