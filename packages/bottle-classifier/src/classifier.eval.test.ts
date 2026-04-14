import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { describeEval } from "vitest-evals";
import { z } from "zod";
import { createBottleClassifier } from "./classifier";
import {
  EVAL_CASES,
  type ClassifierEvalCase,
  type ClassifierEvalExpectation,
} from "./classifier.eval.fixtures";
import type { BottleCandidate } from "./classifierSchemas";
import type { BottleClassificationResult } from "./contract";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_OPENAI_EVAL_MODEL = "gpt-5-mini";
const classifierModel = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
const judgeModel = process.env.OPENAI_EVAL_MODEL ?? DEFAULT_OPENAI_EVAL_MODEL;

function serializeEvalCase(testCase: ClassifierEvalCase): string {
  return JSON.stringify(testCase);
}

function parseEvalCase(value: string): ClassifierEvalCase {
  return JSON.parse(value) as ClassifierEvalCase;
}

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_HOST,
    organization: process.env.OPENAI_ORGANIZATION,
    project: process.env.OPENAI_PROJECT,
  });
}

function collectKnownCandidates(
  testCase: ClassifierEvalCase,
): BottleCandidate[] {
  const knownCandidates = new Map<string, BottleCandidate>();

  for (const candidate of testCase.input.initialCandidates ?? []) {
    const key = `${candidate.bottleId}:${candidate.releaseId ?? "bottle"}`;
    knownCandidates.set(key, candidate);
  }

  for (const response of testCase.searchResponses ?? []) {
    for (const candidate of response.results) {
      const key = `${candidate.bottleId}:${candidate.releaseId ?? "bottle"}`;
      knownCandidates.set(key, candidate);
    }
  }

  return Array.from(knownCandidates.values());
}

function buildSearchBottlesAdapter(testCase: ClassifierEvalCase) {
  return async (args: Record<string, unknown>) => {
    const haystack = JSON.stringify(args).toLowerCase();
    const matchedResponse = (testCase.searchResponses ?? []).find((response) =>
      response.when.every((term) => haystack.includes(term.toLowerCase())),
    );

    return matchedResponse?.results ?? [];
  };
}

function describeClassificationResult(
  result: BottleClassificationResult,
): Record<string, unknown> {
  if (result.status === "ignored") {
    return {
      status: result.status,
      reason: result.reason,
      extractedIdentity: result.artifacts.extractedIdentity,
    };
  }

  const matchedCandidate =
    result.decision.matchedReleaseId !== null
      ? result.artifacts.candidates.find(
          (candidate) =>
            candidate.releaseId === result.decision.matchedReleaseId,
        )
      : result.artifacts.candidates.find(
          (candidate) => candidate.bottleId === result.decision.matchedBottleId,
        );

  return {
    status: result.status,
    decision: {
      action: result.decision.action,
      confidence: result.decision.confidence,
      identityScope: result.decision.identityScope,
      matchedBottleId: result.decision.matchedBottleId,
      matchedReleaseId: result.decision.matchedReleaseId,
      parentBottleId: result.decision.parentBottleId,
      matchedCandidateName: matchedCandidate?.fullName ?? null,
      proposedBottle: result.decision.proposedBottle,
      proposedRelease: result.decision.proposedRelease,
      observation: result.decision.observation,
    },
    extractedIdentity: result.artifacts.extractedIdentity,
  };
}

function parseClassificationResult(output: string): BottleClassificationResult {
  return JSON.parse(output) as BottleClassificationResult;
}

function createDecisionShapeScorer() {
  return async ({
    output,
    expected,
  }: {
    output: string;
    expected: ClassifierEvalExpectation;
  }) => {
    const result = parseClassificationResult(output);
    const checks: boolean[] = [result.status === expected.status];

    if (expected.status === "classified" && result.status === "classified") {
      checks.push(result.decision.action === expected.action);

      if (expected.identityScope !== undefined) {
        checks.push(result.decision.identityScope === expected.identityScope);
      }

      if (expected.matchedBottleId !== undefined) {
        checks.push(
          result.decision.matchedBottleId === expected.matchedBottleId,
        );
      }

      if (expected.matchedReleaseId !== undefined) {
        checks.push(
          result.decision.matchedReleaseId === expected.matchedReleaseId,
        );
      }

      if (expected.parentBottleId !== undefined) {
        checks.push(result.decision.parentBottleId === expected.parentBottleId);
      }
    }

    const score =
      checks.reduce((total, check) => total + (check ? 1 : 0), 0) /
      checks.length;

    return {
      score,
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
    expected: ClassifierEvalExpectation;
  }) => {
    const client = createOpenAIClient();
    const testCase = parseEvalCase(input);
    const result = parseClassificationResult(output);
    const response = await client.responses.create({
      model: judgeModel!,
      instructions: [
        "You are judging a whisky bottle classifier evaluation.",
        "Score from 0.0 to 1.0.",
        "Prioritize whether the classifier identified the correct bottle identity and chose a safe action.",
        "A false positive existing match is worse than a conservative create/no-match result.",
        "For exact-cask code programs such as SMWS, a correct matched bottle id and identity scope should score highly even when the source subtitle remains in observation-level text.",
        "Do not over-penalize selector or subtitle noise when the exact-cask code anchor, matched bottle id, and final action are correct.",
        "Use 1.0 for a clearly correct result, 0.5 for partially correct but materially flawed output, and 0.0 for the wrong bottle or unsafe matching behavior.",
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
                `Expected outcome: ${expected.summary}`,
                `Expected structured constraints: ${JSON.stringify(expected, null, 2)}`,
                `Actual classifier output: ${JSON.stringify(describeClassificationResult(result), null, 2)}`,
              ].join("\n\n"),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(JudgeSchema, "ClassifierEvalJudgement"),
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

describeEval("bottle classifier", {
  skipIf: () => !process.env.OPENAI_API_KEY,
  timeout: 300000,
  data: async () =>
    EVAL_CASES.map((testCase) => ({
      name: testCase.name,
      input: serializeEvalCase(testCase),
      expected: testCase.expected,
    })),
  task: async (serializedTestCase: string) => {
    const testCase = parseEvalCase(serializedTestCase);
    const knownCandidates = collectKnownCandidates(testCase);
    const classifier = createBottleClassifier({
      client: createOpenAIClient(),
      model: classifierModel!,
      maxSearchQueries: Number(
        process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 3,
      ),
      braveApiKey: process.env.BRAVE_API_KEY ?? null,
      adapters: {
        searchBottles: buildSearchBottlesAdapter(testCase),
        getBottleCandidateById: async (bottleId, releaseId) =>
          knownCandidates.find(
            (candidate) =>
              candidate.bottleId === bottleId &&
              (releaseId !== null
                ? candidate.releaseId === releaseId
                : candidate.releaseId === null),
          ) ?? null,
      },
    });

    return {
      result: JSON.stringify(
        await classifier.classifyBottleReference(testCase.input),
      ),
    };
  },
  scorers: [createDecisionShapeScorer(), createJudgeScorer()],
  threshold: 0.8,
});
