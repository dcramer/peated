import { describe, expect, test } from "vitest";
import { CLASSIFIER_SCENARIO_EVAL_CASES } from "./classifier.eval.scenarios";

describe("classifier eval scenarios", () => {
  test("keeps every workflow scenario populated", () => {
    const counts = new Map<string, number>();

    for (const testCase of CLASSIFIER_SCENARIO_EVAL_CASES) {
      counts.set(testCase.scenario, (counts.get(testCase.scenario) ?? 0) + 1);
    }

    expect(counts.get("new_bottles")).toBeGreaterThan(0);
    expect(counts.get("match_existing")).toBeGreaterThan(0);
    expect(counts.get("corrections")).toBeGreaterThan(0);
    expect(counts.get("ignore_or_reject")).toBeGreaterThan(0);
  });

  test("keeps real-world new-bottle evals inside the new-bottles workflow", () => {
    for (const testCase of CLASSIFIER_SCENARIO_EVAL_CASES) {
      if (testCase.kind !== "new_bottle_fixture") {
        continue;
      }

      expect(testCase.scenario).toBe("new_bottles");
    }
  });

  test("keeps correction workflow cases tied to replacing an existing match", () => {
    for (const testCase of CLASSIFIER_SCENARIO_EVAL_CASES) {
      if (testCase.kind !== "decision" || testCase.scenario !== "corrections") {
        continue;
      }

      const currentBottleId = testCase.testCase.input.reference.currentBottleId;
      const currentReleaseId =
        testCase.testCase.input.reference.currentReleaseId;

      expect(testCase.testCase.expected.status).toBe("classified");
      expect(testCase.testCase.expected.action).toBe("match");
      expect(currentBottleId != null || currentReleaseId != null).toBe(true);
      expect(
        currentBottleId !==
          (testCase.testCase.expected.matchedBottleId ?? null) ||
          currentReleaseId !==
            (testCase.testCase.expected.matchedReleaseId ?? null),
      ).toBe(true);
    }
  });

  test("keeps ignore-or-reject workflow cases limited to ignored or no-match outcomes", () => {
    for (const testCase of CLASSIFIER_SCENARIO_EVAL_CASES) {
      if (
        testCase.kind !== "decision" ||
        testCase.scenario !== "ignore_or_reject"
      ) {
        continue;
      }

      expect(
        testCase.testCase.expected.status === "ignored" ||
          testCase.testCase.expected.action === "no_match",
      ).toBe(true);
    }
  });
});
