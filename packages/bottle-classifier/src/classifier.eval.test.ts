import { openaiAgentsHarness } from "@vitest-evals/harness-openai-agents";
import { zodTextFormat } from "openai/helpers/zod";
import { describeEval, namedJudge, type JudgeContext } from "vitest-evals";
import { toJsonValue } from "vitest-evals/harness";
import { z } from "zod";
import type {
  ClassifierEvalCase,
  SearchResponseFixture,
} from "./classifier.eval.fixtures";
import {
  getClassifierLiveEvalCases,
  type ClassifierScenarioEvalCase,
  type LiveClassifierEvalScenario,
} from "./classifier.eval.scenarios";
import {
  createBottleClassifier,
  prepareBottleClassifierAgentRun,
  type PreparedBottleClassifierAgentRun,
} from "./classifierRuntime";
import type { BottleCandidate } from "./classifierTypes";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createDecidedBottleClassification,
  type BottleClassificationResult,
} from "./contract";
import {
  createEvalClassifierOptions,
  createEvalOpenAIClient,
  evalJudgeModel,
  getEvalJudgeModelSettings,
  promptEvalJudgeModel,
} from "./evalSupport";
import { isExistingMatchConfidenceEligibleForVerification } from "./priceMatchingEvidence";
import type { RealWorldNewBottleEvalCase } from "./realWorldNewBottleEval.fixtures";
import {
  finalizeBottleReferenceClassification,
  getAutoIgnoreBottleReferenceReason,
} from "./reviewPolicy";
import { buildDefaultBottleSearchInput } from "./runtime/agentInput";

function getScenarioEvalName(testCase: ClassifierScenarioEvalCase): string {
  return testCase.testCase.input.reference.name;
}

function getScenarioEvalSummary(testCase: ClassifierScenarioEvalCase): string {
  if (testCase.kind === "new_bottle_fixture") {
    return testCase.testCase.summary;
  }

  return testCase.testCase.expected.summary;
}

type SearchFixtureCase = {
  input: ClassifierEvalCase["input"];
  searchResponses?: SearchResponseFixture[];
};

function collectKnownCandidates(
  testCase: SearchFixtureCase,
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

function buildSearchBottlesAdapter(testCase: SearchFixtureCase) {
  return async (args: Record<string, unknown>) => {
    const haystack = JSON.stringify(args).toLowerCase();
    const matchedResponse = (testCase.searchResponses ?? []).find((response) =>
      response.when.every((term) => haystack.includes(term.toLowerCase())),
    );

    return matchedResponse?.results ?? [];
  };
}

function getDerivedVerifyEligibility(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
): boolean {
  if (result.status !== "classified" || result.decision.action !== "match") {
    return false;
  }

  return isExistingMatchConfidenceEligibleForVerification({
    confidence: result.decision.confidence,
    currentBottleId: testCase.input.reference.currentBottleId ?? null,
    currentReleaseId: testCase.input.reference.currentReleaseId ?? null,
    matchedBottleId: result.decision.matchedBottleId,
    matchedReleaseId: result.decision.matchedReleaseId,
  });
}

function describeClassificationResult(
  testCase: ClassifierEvalCase,
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
      verifyEligible: getDerivedVerifyEligibility(testCase, result),
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

function deepContainsSubset(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object") {
    return Object.is(actual, expected);
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) {
      return false;
    }

    return expected.every((value, index) =>
      deepContainsSubset(actual[index], value),
    );
  }

  if (!actual || typeof actual !== "object") {
    return false;
  }

  return Object.entries(expected).every(([key, value]) =>
    deepContainsSubset((actual as Record<string, unknown>)[key], value),
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
    ? [
        result.decision.proposedBottle.brand.name,
        result.decision.proposedBottle.name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim()
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

function describeScenarioOutput(
  testCase: ClassifierScenarioEvalCase,
  result: BottleClassificationResult,
): Record<string, unknown> {
  return testCase.kind === "new_bottle_fixture"
    ? describeNormalizationResult(result)
    : describeClassificationResult(testCase.testCase, result);
}

function scoreDecisionShape(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
): number {
  const expected = testCase.expected;
  const checks: boolean[] = [result.status === expected.status];

  if (expected.status === "classified" && result.status === "classified") {
    checks.push(result.decision.action === expected.action);

    if (expected.identityScope !== undefined) {
      checks.push(result.decision.identityScope === expected.identityScope);
    }

    if (expected.matchedBottleId !== undefined) {
      checks.push(result.decision.matchedBottleId === expected.matchedBottleId);
    }

    if (expected.matchedReleaseId !== undefined) {
      checks.push(
        result.decision.matchedReleaseId === expected.matchedReleaseId,
      );
    }

    if (expected.parentBottleId !== undefined) {
      checks.push(result.decision.parentBottleId === expected.parentBottleId);
    }

    if (expected.confidenceAtLeast !== undefined) {
      checks.push(result.decision.confidence >= expected.confidenceAtLeast);
    }

    if (expected.confidenceBelow !== undefined) {
      checks.push(result.decision.confidence < expected.confidenceBelow);
    }

    if (expected.verifyEligible !== undefined) {
      checks.push(
        getDerivedVerifyEligibility(testCase, result) ===
          expected.verifyEligible,
      );
    }

    if (expected.proposedBottle !== undefined) {
      checks.push(
        deepContainsSubset(
          result.decision.proposedBottle,
          expected.proposedBottle,
        ),
      );
    }

    if (expected.proposedRelease !== undefined) {
      checks.push(
        deepContainsSubset(
          result.decision.proposedRelease,
          expected.proposedRelease,
        ),
      );
    }
  }

  return (
    checks.reduce((total, check) => total + (check ? 1 : 0), 0) / checks.length
  );
}

function scoreNormalizationShape(
  testCase: RealWorldNewBottleEvalCase,
  result: BottleClassificationResult,
): number {
  const expectation = testCase.expected;

  if (expectation.classifierExpectation === "review_required") {
    return result.status === "ignored" ||
      (result.status === "classified" && result.decision.action === "no_match")
      ? 1
      : 0;
  }

  if (result.status !== "classified") {
    return 0;
  }

  if (expectation.classifierExpectation === "exact_cask") {
    return result.decision.identityScope === "exact_cask" ? 1 : 0;
  }

  if (expectation.classifierExpectation === "bottle_plus_release") {
    return result.decision.identityScope === "product" &&
      (result.decision.action === "create_release" ||
        result.decision.action === "create_bottle_and_release" ||
        result.decision.matchedReleaseId !== null)
      ? 1
      : 0;
  }

  return result.decision.identityScope === "product" &&
    result.decision.action !== "create_release" &&
    result.decision.action !== "create_bottle_and_release" &&
    result.decision.matchedReleaseId === null
    ? 1
    : 0;
}

const JudgeSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

async function judgeDecisionCase(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
) {
  const client = createEvalOpenAIClient();
  const verifyEligible = getDerivedVerifyEligibility(testCase, result);
  const response = await client.responses.create({
    model: evalJudgeModel,
    instructions: [
      "You are judging a whisky bottle classifier evaluation.",
      "Score from 0.0 to 1.0.",
      "Prioritize whether the classifier identified the correct bottle identity and chose a safe action.",
      "A false positive existing match is worse than a conservative create/no-match result.",
      "Confidence calibration matters because downstream automatic verification is driven from the classifier's confidence for existing matches.",
      "If an existing bottle match should be safe for automatic verification, the confidence should clear the expected threshold. If the match should remain review-only, the confidence should stay below that threshold.",
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
              `Expected outcome: ${testCase.expected.summary}`,
              `Expected structured constraints: ${JSON.stringify(testCase.expected, null, 2)}`,
              `Actual classifier output: ${JSON.stringify(describeClassificationResult(testCase, result), null, 2)}`,
              `Actual derived verify eligibility: ${verifyEligible}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(JudgeSchema, "ClassifierEvalJudgement"),
    },
    ...getEvalJudgeModelSettings(),
  });

  return JudgeSchema.parse(JSON.parse(response.output_text));
}

async function judgeNormalizationCase(
  testCase: RealWorldNewBottleEvalCase,
  result: BottleClassificationResult,
) {
  const client = createEvalOpenAIClient();
  const describedResult = describeNormalizationResult(result);
  const response = await client.responses.create({
    model: evalJudgeModel,
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
              `Fixture id: ${testCase.fixtureId}`,
              `Raw input: ${testCase.input.reference.name}`,
              `Expected bottle name: ${testCase.expectedBottleName}`,
              `Expected classifier expectation: ${testCase.expected.classifierExpectation}`,
              `Expected release identity: ${JSON.stringify(testCase.expected.releaseIdentity)}`,
              `Expected behavior: ${testCase.summary}`,
              `Actual evaluated identity: ${JSON.stringify(describedResult, null, 2)}`,
              `Raw classifier output: ${JSON.stringify(result)}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(JudgeSchema, "NormalizationCorpusEvalJudgement"),
    },
    ...getEvalJudgeModelSettings(),
  });

  return JudgeSchema.parse(JSON.parse(response.output_text));
}

function parseClassificationRunOutput(
  output: unknown,
): BottleClassificationResult {
  return BottleClassificationResultSchema.parse(output);
}

function buildClassifierAdapters(testCase: ClassifierScenarioEvalCase) {
  // Real-world new-bottle fixtures intentionally share the same local-search
  // path as the main classifier evals. Do not special-case them into a
  // searchless harness or the "new bottles" workflow stops reflecting the
  // real agent.
  const knownCandidates = collectKnownCandidates(testCase.testCase);

  return {
    searchBottles: buildSearchBottlesAdapter(testCase.testCase),
    getBottleCandidateById: async (
      bottleId: number,
      releaseId: number | null,
    ) =>
      knownCandidates.find(
        (candidate) =>
          candidate.bottleId === bottleId &&
          (releaseId !== null
            ? candidate.releaseId === releaseId
            : candidate.releaseId === null),
      ) ?? null,
  };
}

function createClassifierOptions(testCase: ClassifierScenarioEvalCase) {
  return createEvalClassifierOptions(buildClassifierAdapters(testCase));
}

type PreparedScenarioClassifierRun = {
  agentRun: PreparedBottleClassifierAgentRun;
  classifyAgentResult: (result: unknown) => BottleClassificationResult;
};

async function prepareScenarioClassifierRun(
  testCase: ClassifierScenarioEvalCase,
): Promise<PreparedScenarioClassifierRun> {
  const options = createClassifierOptions(testCase);
  const classifier = createBottleClassifier(options);
  const parsedInput = ClassifyBottleReferenceInputSchema.parse(
    testCase.testCase.input,
  );
  const extractedIdentity =
    parsedInput.extractedIdentity !== undefined
      ? parsedInput.extractedIdentity
      : await classifier.extractBottleReferenceIdentity(parsedInput.reference);
  const initialArtifacts = buildBottleClassificationArtifacts({
    extractedIdentity,
  });
  const autoIgnoreReason = getAutoIgnoreBottleReferenceReason(
    parsedInput.reference.name,
    initialArtifacts.extractedIdentity,
  );

  if (autoIgnoreReason) {
    throw new Error(
      `Native replay evals require the classifier agent path, but ${parsedInput.reference.name} was auto-ignored: ${autoIgnoreReason}`,
    );
  }

  const candidates =
    parsedInput.initialCandidates ??
    (options.adapters.findInitialCandidates
      ? await options.adapters.findInitialCandidates({
          reference: parsedInput.reference,
          extractedIdentity,
        })
      : await options.adapters.searchBottles(
          buildDefaultBottleSearchInput({
            reference: parsedInput.reference,
            extractedIdentity,
          }),
        ));
  const artifacts = buildBottleClassificationArtifacts({
    extractedIdentity,
    candidates,
  });

  const agentRun = await prepareBottleClassifierAgentRun(options, {
    reference: parsedInput.reference,
    extractedIdentity: artifacts.extractedIdentity,
    initialCandidates: artifacts.candidates,
    candidateExpansion: parsedInput.candidateExpansion,
  });

  return {
    agentRun,
    classifyAgentResult: (result) => {
      const reasoning = agentRun.getReasoningResult(result);
      const decision = finalizeBottleReferenceClassification({
        reference: parsedInput.reference,
        decision: reasoning.decision,
        artifacts: reasoning.artifacts,
      });

      return BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision,
          artifacts: reasoning.artifacts,
        }),
      );
    },
  };
}

type ClassifierHarnessMetadata = {
  summary: string;
};

const preparedClassifierRuns = new WeakMap<
  ClassifierScenarioEvalCase,
  Promise<PreparedScenarioClassifierRun>
>();

function getPreparedClassifierRun(input: ClassifierScenarioEvalCase) {
  let preparedRun = preparedClassifierRuns.get(input);
  if (!preparedRun) {
    preparedRun = prepareScenarioClassifierRun(input);
    preparedClassifierRuns.set(input, preparedRun);
  }

  return preparedRun;
}

const classifierHarness = openaiAgentsHarness<
  PreparedBottleClassifierAgentRun["agent"],
  ClassifierScenarioEvalCase,
  ClassifierHarnessMetadata,
  PreparedBottleClassifierAgentRun["runner"],
  BottleClassificationResult
>({
  name: "bottle-classifier",
  createAgent: async ({ input }) =>
    (await getPreparedClassifierRun(input)).agentRun.agent,
  createRunner: async ({ input }) =>
    (await getPreparedClassifierRun(input)).agentRun.runner,
  prompt: promptEvalJudgeModel,
  runOptions: async ({ input }) => {
    const { maxTurns } = (await getPreparedClassifierRun(input)).agentRun
      .runOptions;
    return {
      maxTurns,
      stream: false,
    };
  },
  run: async ({ agent, input, runner, runOptions }) => {
    if (!runner) {
      throw new Error("Classifier eval runner was not prepared.");
    }

    const preparedRun = await getPreparedClassifierRun(input);
    const result = await runner.run(agent, preparedRun.agentRun.input, {
      ...runOptions,
      stream: false,
    });

    return preparedRun.classifyAgentResult(result);
  },
  toolReplay: {
    openai_web_search: true,
    brave_web_search: true,
  },
  normalize: {
    output: ({ result }) => toJsonValue(result) ?? null,
    outputText: ({ input, result }) =>
      JSON.stringify(describeScenarioOutput(input, result), null, 2),
  },
});

type ClassifierJudgeContext = JudgeContext<
  ClassifierScenarioEvalCase,
  ClassifierHarnessMetadata,
  typeof classifierHarness
>;

const ClassifierShapeJudge = namedJudge<ClassifierJudgeContext>(
  "ClassifierShapeJudge",
  ({ inputValue, run }) => {
    const result = parseClassificationRunOutput(run.output);

    return {
      score:
        inputValue.kind === "new_bottle_fixture"
          ? scoreNormalizationShape(inputValue.testCase, result)
          : scoreDecisionShape(inputValue.testCase, result),
    };
  },
);

const ClassifierRubricJudge = namedJudge<ClassifierJudgeContext>(
  "ClassifierRubricJudge",
  async ({ inputValue, run }) => {
    const result = parseClassificationRunOutput(run.output);
    const judgement =
      inputValue.kind === "new_bottle_fixture"
        ? await judgeNormalizationCase(inputValue.testCase, result)
        : await judgeDecisionCase(inputValue.testCase, result);

    return {
      score: judgement.score,
      metadata: {
        rationale: judgement.reasoning,
      },
    };
  },
);

const SCENARIO_CONFIG: Array<{
  label: string;
  scenario: LiveClassifierEvalScenario;
  threshold: number;
}> = [
  {
    label: "new bottles",
    scenario: "new_bottles",
    threshold: 0.7,
  },
  {
    label: "match existing",
    scenario: "match_existing",
    threshold: 0.8,
  },
  {
    label: "corrections",
    scenario: "corrections",
    threshold: 0.8,
  },
];

for (const { label, scenario, threshold } of SCENARIO_CONFIG) {
  describeEval(
    label,
    {
      skipIf: () => !process.env.OPENAI_API_KEY,
      harness: classifierHarness,
      judges: [ClassifierShapeJudge, ClassifierRubricJudge],
      judgeThreshold: threshold,
    },
    (it) => {
      const cases = getClassifierLiveEvalCases(scenario).map((testCase) => ({
        name: getScenarioEvalName(testCase),
        summary: getScenarioEvalSummary(testCase),
        testCase,
      }));

      it.for(cases)("$name", async ({ testCase, summary }, { run }) => {
        await run(testCase, {
          metadata: {
            summary,
          },
        });
      });
    },
  );
}
