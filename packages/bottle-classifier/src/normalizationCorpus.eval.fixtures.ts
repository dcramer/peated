import type { ClassifyBottleReferenceInput } from "./contract";
import {
  BOTTLE_NORMALIZATION_CORPUS_BY_ID,
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

function requireCorpusExample(id: string): BottleNormalizationCorpusExample {
  const example = BOTTLE_NORMALIZATION_CORPUS_BY_ID.get(id);

  if (!example) {
    throw new Error(`Unknown bottle normalization corpus example: ${id}`);
  }

  return example;
}

function buildEvalCase(
  id: string,
  summary: string,
): NormalizationCorpusEvalCase {
  const example = requireCorpusExample(id);

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
    summary,
  };
}

export const NORMALIZATION_CORPUS_EVAL_CASES: NormalizationCorpusEvalCase[] = [
  buildEvalCase(
    "springbank-batch-release",
    "Keep the stable Springbank 12 Cask Strength bottle identity and recognize Batch 24 as release-level identity instead of collapsing everything into one bottle.",
  ),
  buildEvalCase(
    "lagavulin-distillers-edition-year-release",
    "Preserve Distillers Edition as the bottle family and treat 2011 Release as release-level identity rather than a whole separate bottle family.",
  ),
  buildEvalCase(
    "makers-private-selection-code",
    "Treat Private Selection as the bottle and the S2B13 code as release identity instead of ignoring the code or folding it into the bottle name.",
  ),
  buildEvalCase(
    "batch-strength-family",
    "Keep Batch Strength as a bottle-level identity and avoid inventing a fake release split from the word Batch alone.",
  ),
  buildEvalCase(
    "batch-sherry-family",
    "Treat bare Batch Sherry as too sparse for a specific canonical bottle and avoid inventing a branded identity from generic Batch wording.",
  ),
  buildEvalCase(
    "macallan-double-cask",
    "Keep Double Cask as bottle-level identity and avoid creating a child release from stable marketed family wording.",
  ),
  buildEvalCase(
    "elijah-craig-cask-strength",
    "Normalize Elijah Craig Cask Strength shorthand to the canonical Elijah Craig Barrel Proof bottle family unless there is an actual batch code or release marker.",
  ),
  buildEvalCase(
    "smws-code-bottle",
    "Recognize the SMWS code as exact-cask identity rather than splitting it into a bottle plus child release.",
  ),
  buildEvalCase(
    "octomore-dot-expression",
    "Treat Octomore 13.1 as a distinct bottle identity, not as Octomore 13 with a child release.",
  ),
];
