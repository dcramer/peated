import { describe, expect, test } from "vitest";
import { BOTTLE_NORMALIZATION_CORPUS } from "./normalizationCorpus";
import { NORMALIZATION_CORPUS_EVAL_CASES } from "./normalizationCorpus.eval.fixtures";

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

  test("keeps classifier-owned cases off deterministic release-repair fast paths", () => {
    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      if (example.expectation.handlingStrategy !== "classifier_required") {
        continue;
      }

      expect(example.expectation.deterministicReleaseExpectation).toBe("none");
    }
  });

  test("keeps block-if-uncertain cases out of deterministic fast paths", () => {
    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      if (example.expectation.handlingStrategy !== "block_if_uncertain") {
        continue;
      }

      expect(example.expectation.classifierExpectation).toBe("review_required");
      expect(example.expectation.deterministicReleaseExpectation).toBe("none");
    }
  });

  test("keeps normalization evals focused on classifier-owned ambiguity", () => {
    for (const testCase of NORMALIZATION_CORPUS_EVAL_CASES) {
      const example = BOTTLE_NORMALIZATION_CORPUS.find(
        (candidate) => candidate.id === testCase.corpusExampleId,
      );

      expect(example).toBeDefined();
      expect(
        example!.expectation.handlingStrategy === "deterministic_safe"
          ? example!.expectation.classifierExpectation
          : example!.expectation.handlingStrategy,
      ).not.toBe("deterministic_safe");
    }
  });

  test("keeps live eval metadata explicit and narrow", () => {
    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      if (example.liveEvalCoverage !== "required") {
        expect(example.liveEvalSummary).toBeUndefined();
        continue;
      }

      expect(example.liveEvalSummary).toBeTruthy();
      if (example.expectation.handlingStrategy === "deterministic_safe") {
        expect(example.expectation.classifierExpectation).toBe("exact_cask");
      }
    }
  });

  test("keeps ambiguous contrast groups covered by multiple outcomes", () => {
    const groups = new Map<
      string,
      {
        exampleCount: number;
        outcomes: Set<string>;
      }
    >();

    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      if (!example.contrastGroup) {
        expect(example.contrastOutcome).toBeUndefined();
        continue;
      }

      expect(example.contrastOutcome).toBeDefined();

      const expectation = example.expectation;
      if (example.contrastOutcome === "split_release") {
        expect(expectation.releaseIdentity).not.toBeNull();
      } else {
        expect(expectation.releaseIdentity).toBeNull();
      }

      const group = groups.get(example.contrastGroup) ?? {
        exampleCount: 0,
        outcomes: new Set<string>(),
      };

      group.exampleCount += 1;
      group.outcomes.add(example.contrastOutcome!);
      groups.set(example.contrastGroup, group);
    }

    for (const { exampleCount, outcomes } of groups.values()) {
      expect(exampleCount).toBeGreaterThan(1);
      expect(outcomes.size).toBeGreaterThan(1);
    }
  });

  test("uses valid Peated bottle ids when provenance is recorded", () => {
    for (const example of BOTTLE_NORMALIZATION_CORPUS) {
      if (!example.peatedBottleIds) {
        continue;
      }

      expect(example.peatedBottleIds.length).toBeGreaterThan(0);
      expect(new Set(example.peatedBottleIds).size).toBe(
        example.peatedBottleIds.length,
      );

      for (const bottleId of example.peatedBottleIds) {
        expect(Number.isInteger(bottleId)).toBe(true);
        expect(bottleId).toBeGreaterThan(0);
      }
    }
  });
});
