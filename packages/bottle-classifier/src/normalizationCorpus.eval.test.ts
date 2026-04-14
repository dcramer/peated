import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { describeEval } from "vitest-evals";
import { z } from "zod";
import { createBottleClassifier } from "./classifier";
import type { BottleClassificationResult } from "./contract";
import {
  NORMALIZATION_CORPUS_EVAL_CASES,
  type NormalizationCorpusEvalCase,
} from "./normalizationCorpus.eval.fixtures";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_OPENAI_EVAL_MODEL = "gpt-5-mini";
const classifierModel = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
const judgeModel = process.env.OPENAI_EVAL_MODEL ?? DEFAULT_OPENAI_EVAL_MODEL;

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_HOST,
    organization: process.env.OPENAI_ORGANIZATION,
    project: process.env.OPENAI_PROJECT,
  });
}

function serializeEvalCase(testCase: NormalizationCorpusEvalCase): string {
  return JSON.stringify(testCase);
}

function parseEvalCase(value: string): NormalizationCorpusEvalCase {
  return JSON.parse(value) as NormalizationCorpusEvalCase;
}

function parseClassificationResult(output: string): BottleClassificationResult {
  return JSON.parse(output) as BottleClassificationResult;
}

function getComparableFullBottleName(
  brand: null | string | undefined,
  name: null | string | undefined,
): null | string {
  if (!name) {
    return null;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return null;
  }

  if (!brand) {
    return trimmedName;
  }

  const trimmedBrand = brand.trim();
  if (!trimmedBrand) {
    return trimmedName;
  }

  if (trimmedName.toLowerCase().startsWith(`${trimmedBrand.toLowerCase()} `)) {
    return trimmedName;
  }

  return `${trimmedBrand} ${trimmedName}`;
}

function normalizeComparableIdentity(value: null | string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasMatchingBottleIdentity({
  actualBottleIdentity,
  expectedBottleName,
}: {
  actualBottleIdentity: null | string;
  expectedBottleName: string;
}): boolean {
  const actual = normalizeComparableIdentity(actualBottleIdentity);
  const expected = normalizeComparableIdentity(expectedBottleName);

  return actual.length > 0 && actual === expected;
}

function hasMatchingReleaseIdentity({
  actual,
  expected,
}: {
  actual: {
    edition: null | string;
    releaseYear: null | number;
  } | null;
  expected: NormalizationCorpusEvalCase["expected"]["releaseIdentity"];
}): boolean {
  if (expected === null) {
    return actual === null;
  }

  if (!actual) {
    return false;
  }

  return (
    (expected.edition ?? null) === (actual.edition ?? null) &&
    (expected.releaseYear ?? null) === (actual.releaseYear ?? null)
  );
}

function describeNormalizationResult(
  result: BottleClassificationResult,
): Record<string, unknown> {
  if (result.status === "ignored") {
    return {
      status: "ignored",
      reason: result.reason,
    };
  }

  const matchedCandidate =
    result.decision.matchedReleaseId !== null
      ? result.artifacts.candidates.find(
          (candidate) =>
            candidate.releaseId === result.decision.matchedReleaseId,
        )
      : result.artifacts.candidates.find((candidate) =>
          result.decision.action === "create_release"
            ? candidate.bottleId === result.decision.parentBottleId
            : candidate.bottleId === result.decision.matchedBottleId,
        );

  const proposedBottleFullName = result.decision.proposedBottle
    ? getComparableFullBottleName(
        result.decision.proposedBottle.brand.name,
        result.decision.proposedBottle.name,
      )
    : null;

  return {
    status: "classified",
    action: result.decision.action,
    identityScope: result.decision.identityScope,
    bottleIdentity:
      matchedCandidate?.bottleFullName ??
      matchedCandidate?.fullName ??
      proposedBottleFullName,
    releaseIdentity:
      result.decision.proposedRelease !== null
        ? {
            edition: result.decision.proposedRelease.edition,
            releaseYear: result.decision.proposedRelease.releaseYear,
          }
        : matchedCandidate?.releaseId != null
          ? {
              edition: matchedCandidate.edition,
              releaseYear: matchedCandidate.releaseYear,
            }
          : null,
    proposedBottle:
      result.decision.proposedBottle !== null
        ? {
            brand: result.decision.proposedBottle.brand.name,
            name: result.decision.proposedBottle.name,
            fullName: proposedBottleFullName,
            series: result.decision.proposedBottle.series?.name ?? null,
          }
        : null,
    matchedCandidateName: matchedCandidate?.fullName ?? null,
  };
}

const JudgeSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

function createShapeScorer() {
  return async ({
    output,
    expected,
  }: {
    output: string;
    expected: {
      expected: NormalizationCorpusEvalCase["expected"];
      expectedBottleName: string;
      summary: string;
    };
  }) => {
    const result = parseClassificationResult(output);
    const expectation = expected.expected;

    if (expectation.classifierExpectation === "review_required") {
      return {
        score:
          result.status === "ignored" ||
          (result.status === "classified" &&
            result.decision.action === "no_match")
            ? 1
            : 0,
      };
    }

    if (result.status !== "classified") {
      return { score: 0 };
    }

    if (expectation.classifierExpectation === "exact_cask") {
      return {
        score: result.decision.identityScope === "exact_cask" ? 1 : 0,
      };
    }

    if (expectation.classifierExpectation === "bottle_plus_release") {
      return {
        score:
          result.decision.identityScope === "product" &&
          (result.decision.action === "create_release" ||
            result.decision.action === "create_bottle_and_release" ||
            result.decision.matchedReleaseId !== null)
            ? 1
            : 0,
      };
    }

    return {
      score:
        result.decision.identityScope === "product" &&
        result.decision.action !== "create_release" &&
        result.decision.action !== "create_bottle_and_release" &&
        result.decision.matchedReleaseId === null
          ? 1
          : 0,
    };
  };
}

function createJudgeScorer() {
  return async ({
    input,
    output,
    expected,
  }: {
    input: string;
    output: string;
    expected: {
      summary: string;
      expectedBottleName: string;
      expected: NormalizationCorpusEvalCase["expected"];
    };
  }) => {
    const client = createOpenAIClient();
    const testCase = parseEvalCase(input);
    const result = parseClassificationResult(output);
    const describedResult = describeNormalizationResult(result);
    const actualReleaseIdentity =
      describedResult.releaseIdentity &&
      typeof describedResult.releaseIdentity === "object"
        ? {
            edition:
              "edition" in describedResult.releaseIdentity &&
              (typeof describedResult.releaseIdentity.edition === "string" ||
                describedResult.releaseIdentity.edition === null)
                ? describedResult.releaseIdentity.edition
                : null,
            releaseYear:
              "releaseYear" in describedResult.releaseIdentity &&
              (typeof describedResult.releaseIdentity.releaseYear ===
                "number" ||
                describedResult.releaseIdentity.releaseYear === null)
                ? describedResult.releaseIdentity.releaseYear
                : null,
          }
        : null;
    const deterministicHints = {
      bottleIdentityMatchesExpected: hasMatchingBottleIdentity({
        actualBottleIdentity:
          typeof describedResult.bottleIdentity === "string"
            ? describedResult.bottleIdentity
            : null,
        expectedBottleName: expected.expectedBottleName,
      }),
      releaseIdentityMatchesExpected: hasMatchingReleaseIdentity({
        actual: actualReleaseIdentity,
        expected: expected.expected.releaseIdentity,
      }),
      extractedIdentity: result.artifacts.extractedIdentity,
    };
    const response = await client.responses.create({
      model: judgeModel!,
      instructions: [
        "You are judging a whisky bottle normalization evaluation.",
        "Score from 0.0 to 1.0.",
        "Prioritize whether the classifier preserved the correct canonical bottle identity boundary.",
        "Judge bottle identity using the canonical full bottle identity, not just the internal `proposedBottle.name` field in isolation.",
        "For create decisions, combine the proposed brand and bottle name when reasoning about the final bottle identity.",
        "For bottle-level cases, penalize invented child releases or exact-cask scope.",
        "For bottle-plus-release cases, penalize collapsing the release into the bottle name.",
        "For exact-cask cases, penalize product-scope decisions that discard the exact program identity.",
        "For exact-cask code programs such as SMWS, treat an exact bottle-identity match on the code as strong evidence of correctness even when extra official bottle facts are also present.",
        "If deterministic hints say the bottle identity matches the expected canonical bottle, do not score the result as zero unless another part of the output clearly crosses the wrong bottle boundary.",
        "When a bottle-plus-release case is conservatively downgraded to `no_match`, treat preserved extracted identity and rationale as partial credit rather than a total miss.",
        "For review-required cases, prefer conservative ignored or no-match outcomes over inventing a specific branded bottle from sparse input.",
        "Return only the structured judgement.",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Corpus example: ${testCase.corpusExampleId}`,
                `Raw input: ${testCase.input.reference.name}`,
                `Expected bottle name: ${expected.expectedBottleName}`,
                `Expected classifier expectation: ${expected.expected.classifierExpectation}`,
                `Expected release identity: ${JSON.stringify(expected.expected.releaseIdentity)}`,
                `Expected behavior: ${expected.summary}`,
                `Deterministic hints: ${JSON.stringify(deterministicHints, null, 2)}`,
                `Actual evaluated identity: ${JSON.stringify(describedResult, null, 2)}`,
                `Raw classifier output: ${output}`,
              ].join("\n\n"),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(JudgeSchema, "NormalizationCorpusEvalJudgement"),
      },
      ...getDeterministicOpenAISettings(judgeModel!),
    });

    const judgement = JudgeSchema.parse(JSON.parse(response.output_text));
    return {
      score: judgement.score,
      metadata: {
        rationale: judgement.reasoning,
      },
    };
  };
}

describeEval("bottle normalization corpus", {
  skipIf: () => !process.env.OPENAI_API_KEY,
  timeout: 300000,
  data: async () =>
    NORMALIZATION_CORPUS_EVAL_CASES.map((testCase) => ({
      name: testCase.name,
      input: serializeEvalCase(testCase),
      expected: {
        summary: testCase.summary,
        expectedBottleName: testCase.expectedBottleName,
        expected: testCase.expected,
      },
    })),
  task: async (serializedTestCase: string) => {
    const testCase = parseEvalCase(serializedTestCase);
    const classifier = createBottleClassifier({
      client: createOpenAIClient(),
      model: classifierModel!,
      maxSearchQueries: Number(
        process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 3,
      ),
      braveApiKey: process.env.BRAVE_API_KEY ?? null,
      adapters: {
        searchBottles: async () => [],
        getBottleCandidateById: async () => null,
      },
    });

    return {
      result: JSON.stringify(
        await classifier.classifyBottleReference(testCase.input),
      ),
    };
  },
  scorers: [createShapeScorer(), createJudgeScorer()],
  threshold: 0.7,
});
