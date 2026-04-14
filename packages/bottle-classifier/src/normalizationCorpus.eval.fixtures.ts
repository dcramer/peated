import type { ClassifyBottleReferenceInput } from "./contract";
import {
  BOTTLE_NORMALIZATION_CORPUS,
  type BottleNormalizationCorpusExample,
  type BottleNormalizationExpectation,
} from "./normalizationCorpus";

export type NormalizationCorpusEvalCase = {
  corpusExampleId: string;
  name: string;
  input: ClassifyBottleReferenceInput;
  expectedBottleName: string;
  expected: BottleNormalizationExpectation;
  summary: string;
};

function buildEvalCase(
  example: BottleNormalizationCorpusExample,
): NormalizationCorpusEvalCase {
  return {
    corpusExampleId: example.id,
    name: example.inputName,
    input: {
      reference: {
        name: example.inputName,
      },
    },
    expectedBottleName: example.expectedBottleName,
    expected: example.expectation,
    summary: example.liveEvalSummary!,
  };
}

function buildClassifierOwnedEvalCase(
  example: BottleNormalizationCorpusExample,
): NormalizationCorpusEvalCase {
  if (
    !(
      ["classifier_required", "block_if_uncertain"].includes(
        example.expectation.handlingStrategy,
      ) || example.expectation.classifierExpectation === "exact_cask"
    )
  ) {
    throw new Error(
      `Normalization eval fixtures should stay focused on classifier-owned ambiguity. ${example.id} is ${example.expectation.handlingStrategy}.`,
    );
  }

  if (!example.liveEvalSummary) {
    throw new Error(
      `Normalization eval fixtures require a liveEvalSummary. ${example.id} is missing one.`,
    );
  }

  return buildEvalCase(example);
}

export const NORMALIZATION_CORPUS_EVAL_CASES: NormalizationCorpusEvalCase[] =
  BOTTLE_NORMALIZATION_CORPUS.filter(
    (example) => example.liveEvalCoverage === "required",
  ).map(buildClassifierOwnedEvalCase);
