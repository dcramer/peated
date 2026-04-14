import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { describeEval } from "vitest-evals";
import { z } from "zod";
import { createBottleClassifier } from "./classifier";
import type { BottleClassificationResult } from "./contract";
import { resolveLegacyCreateParentClassification } from "./legacyReleaseRepairResolution";
import {
  LEGACY_RELEASE_REPAIR_RESOLUTION_EVAL_CASES,
  type LegacyReleaseRepairResolutionEvalCase,
} from "./legacyReleaseRepairResolution.eval.fixtures";
import {
  DEFAULT_OPENAI_EVAL_MODEL,
  DEFAULT_OPENAI_MODEL,
  getDeterministicOpenAISettings,
} from "./openaiModelSettings";

const classifierModel = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
const judgeModel = process.env.OPENAI_EVAL_MODEL ?? DEFAULT_OPENAI_EVAL_MODEL;

type EvaluatedRepairResolution = {
  classification: BottleClassificationResult;
  resolution:
    | {
        parentBottleId: number;
        resolution: "reuse_existing_parent";
      }
    | {
        resolution: "allow_create_parent";
      }
    | {
        blockedReason: string;
        resolution: "blocked";
      };
};

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_HOST,
    organization: process.env.OPENAI_ORGANIZATION,
    project: process.env.OPENAI_PROJECT,
  });
}

function serializeEvalCase(
  testCase: LegacyReleaseRepairResolutionEvalCase,
): string {
  return JSON.stringify(testCase);
}

function parseEvalCase(value: string): LegacyReleaseRepairResolutionEvalCase {
  return JSON.parse(value) as LegacyReleaseRepairResolutionEvalCase;
}

function parseEvalResult(output: string): EvaluatedRepairResolution {
  return JSON.parse(output) as EvaluatedRepairResolution;
}

function createShapeScorer() {
  return async ({
    output,
    expected,
  }: {
    output: string;
    expected: LegacyReleaseRepairResolutionEvalCase["expected"];
  }) => {
    const result = parseEvalResult(output);
    const checks = [result.resolution.resolution === expected.resolution];

    if (
      expected.resolution === "reuse_existing_parent" &&
      result.resolution.resolution === "reuse_existing_parent"
    ) {
      checks.push(result.resolution.parentBottleId === expected.parentBottleId);
    }

    if (
      expected.resolution === "blocked" &&
      result.resolution.resolution === "blocked"
    ) {
      checks.push(result.resolution.blockedReason === expected.blockedReason);
    }

    return {
      score:
        checks.reduce((total, check) => total + (check ? 1 : 0), 0) /
        checks.length,
    };
  };
}

const JudgeSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

function createJudgeScorer() {
  return async ({
    input,
    output,
    expected,
  }: {
    input: string;
    output: string;
    expected: LegacyReleaseRepairResolutionEvalCase["expected"];
  }) => {
    const client = createOpenAIClient();
    const testCase = parseEvalCase(input);
    const result = parseEvalResult(output);
    const response = await client.responses.create({
      model: judgeModel!,
      instructions: [
        "You are judging a whisky legacy release repair evaluation.",
        "Score from 0.0 to 1.0.",
        "Prioritize whether the classifier leads to the correct repair boundary: reuse an existing parent, allow create-parent, or block.",
        "False-positive reuse is worse than conservative blocking.",
        "Exact-cask bottles should block reusable-parent repair behavior.",
        "Dirty release-like legacy bottles should not be treated as reusable clean parents.",
        "Score the final repair resolution more heavily than the raw classifier rationale that preceded it.",
        "If the adapter correctly blocks a dirty legacy bottle or exact-cask candidate, score that highly even when the underlying classifier initially matched the legacy row.",
        "Return only the structured judgement.",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Case: ${testCase.name}`,
                `Reference: ${testCase.input.reference.name}`,
                `Expected repair outcome: ${expected.summary}`,
                `Expected structured outcome: ${JSON.stringify(expected, null, 2)}`,
                `Actual evaluated output: ${JSON.stringify(result, null, 2)}`,
              ].join("\n\n"),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(
          JudgeSchema,
          "LegacyReleaseRepairResolutionEvalJudgement",
        ),
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

describeEval("legacy release repair resolution", {
  skipIf: () => !process.env.OPENAI_API_KEY,
  timeout: 300000,
  data: async () =>
    LEGACY_RELEASE_REPAIR_RESOLUTION_EVAL_CASES.map((testCase) => ({
      name: testCase.name,
      input: serializeEvalCase(testCase),
      expected: testCase.expected,
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

    const classification = await classifier.classifyBottleReference(
      testCase.input,
    );
    const resolution = resolveLegacyCreateParentClassification({
      classification,
      parentRows: testCase.reviewedParentRows,
    });

    return {
      result: JSON.stringify({
        classification,
        resolution:
          resolution.resolution === "reuse_existing_parent"
            ? {
                resolution: "reuse_existing_parent",
                parentBottleId: resolution.parentBottle.id,
              }
            : resolution.resolution === "allow_create_parent"
              ? {
                  resolution: "allow_create_parent",
                }
              : {
                  resolution: "blocked",
                  blockedReason: resolution.reason,
                },
      } satisfies EvaluatedRepairResolution),
    };
  },
  scorers: [createShapeScorer(), createJudgeScorer()],
  threshold: 0.7,
});
