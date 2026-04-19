import {
  EVAL_CASES,
  type ClassifierEvalCase,
} from "./classifier.eval.fixtures";
import {
  NORMALIZATION_CORPUS_EVAL_CASES,
  type NormalizationCorpusEvalCase,
} from "./normalizationCorpus.eval.fixtures";

export type ClassifierEvalScenario =
  | "new_bottles"
  | "match_existing"
  | "corrections"
  | "ignore_or_reject";

export type DecisionScenarioEvalCase = {
  kind: "decision";
  scenario: ClassifierEvalScenario;
  testCase: ClassifierEvalCase;
};

export type NormalizationScenarioEvalCase = {
  kind: "normalization";
  scenario: "new_bottles";
  testCase: NormalizationCorpusEvalCase;
};

export type ClassifierScenarioEvalCase =
  | DecisionScenarioEvalCase
  | NormalizationScenarioEvalCase;

function inferDecisionScenario(
  testCase: ClassifierEvalCase,
): ClassifierEvalScenario {
  if (
    testCase.expected.status === "ignored" ||
    testCase.expected.action === "no_match"
  ) {
    return "ignore_or_reject";
  }

  if (testCase.expected.status === "classified") {
    const currentBottleId = testCase.input.reference.currentBottleId ?? null;
    const currentReleaseId = testCase.input.reference.currentReleaseId ?? null;

    if (
      testCase.expected.action === "match" &&
      (currentBottleId !== null || currentReleaseId !== null)
    ) {
      const matchedBottleId = testCase.expected.matchedBottleId ?? null;
      const matchedReleaseId = testCase.expected.matchedReleaseId ?? null;

      return currentBottleId === matchedBottleId &&
        currentReleaseId === matchedReleaseId
        ? "match_existing"
        : "corrections";
    }

    if (testCase.expected.action === "match") {
      return "match_existing";
    }
  }

  return "new_bottles";
}

function wrapDecisionEvalCase(
  testCase: ClassifierEvalCase,
): DecisionScenarioEvalCase {
  return {
    kind: "decision",
    scenario: inferDecisionScenario(testCase),
    testCase,
  };
}

function wrapNormalizationEvalCase(
  testCase: NormalizationCorpusEvalCase,
): NormalizationScenarioEvalCase {
  return {
    kind: "normalization",
    scenario: "new_bottles",
    testCase,
  };
}

export const CLASSIFIER_SCENARIO_EVAL_CASES: ClassifierScenarioEvalCase[] = [
  ...NORMALIZATION_CORPUS_EVAL_CASES.map(wrapNormalizationEvalCase),
  ...EVAL_CASES.map(wrapDecisionEvalCase),
];

export function getClassifierScenarioEvalCases(
  scenario: ClassifierEvalScenario,
): ClassifierScenarioEvalCase[] {
  return CLASSIFIER_SCENARIO_EVAL_CASES.filter(
    (testCase) => testCase.scenario === scenario,
  );
}
