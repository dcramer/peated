import { openaiAgentsHarness } from "@vitest-evals/harness-openai-agents";
import { zodTextFormat } from "openai/helpers/zod";
import { describeEval, namedJudge, type JudgeContext } from "vitest-evals";
import { toJsonValue } from "vitest-evals/harness";
import { z } from "zod";
import {
  createBottleClassifier,
  finalizeBottleClassifierReasoningResult,
  prepareBottleClassifierAgentRun,
  type PreparedBottleClassifierAgentRun,
} from "./classifierRuntime";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createDecidedBottleClassification,
} from "./contract";
import {
  createEvalClassifierOptions,
  createEvalOpenAIClient,
  evalJudgeModel,
  getEvalJudgeModelSettings,
  promptEvalJudgeModel,
} from "./evalSupport";
import { resolveLegacyCreateParentClassification } from "./legacyReleaseRepairResolution";
import {
  LEGACY_RELEASE_REPAIR_RESOLUTION_EVAL_CASES,
  type LegacyReleaseRepairResolutionEvalCase,
} from "./legacyReleaseRepairResolution.eval.fixtures";
import { getAutoIgnoreBottleReferenceReason } from "./reviewPolicy";
import { buildDefaultBottleSearchInput } from "./runtime/agentInput";

const EvaluatedRepairResolutionSchema = z
  .object({
    classification: BottleClassificationResultSchema,
    resolution: z.discriminatedUnion("resolution", [
      z
        .object({
          resolution: z.literal("reuse_existing_parent"),
          parentBottleId: z.number(),
        })
        .strict(),
      z
        .object({
          resolution: z.literal("allow_create_parent"),
        })
        .strict(),
      z
        .object({
          resolution: z.literal("blocked"),
          blockedReason: z.string(),
        })
        .strict(),
    ]),
  })
  .strict();

type EvaluatedRepairResolution = z.infer<
  typeof EvaluatedRepairResolutionSchema
>;

function parseRepairRunOutput(output: unknown): EvaluatedRepairResolution {
  return EvaluatedRepairResolutionSchema.parse(output);
}

function scoreRepairShape(
  result: EvaluatedRepairResolution,
  expected: LegacyReleaseRepairResolutionEvalCase["expected"],
) {
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

  return (
    checks.reduce((total, check) => total + (check ? 1 : 0), 0) / checks.length
  );
}

const JudgeSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

async function judgeRepairCase(
  testCase: LegacyReleaseRepairResolutionEvalCase,
  result: EvaluatedRepairResolution,
) {
  const client = createEvalOpenAIClient();
  const response = await client.responses.create({
    model: evalJudgeModel,
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
              `Expected repair outcome: ${testCase.expected.summary}`,
              `Expected structured outcome: ${JSON.stringify(testCase.expected, null, 2)}`,
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
    ...getEvalJudgeModelSettings(),
  });

  return JudgeSchema.parse(JSON.parse(response.output_text));
}

function createClassifierOptions() {
  return createEvalClassifierOptions({
    searchBottles: async () => [],
    getBottleCandidateById: async () => null,
  });
}

type PreparedRepairResolutionRun = {
  agentRun: PreparedBottleClassifierAgentRun;
  evaluateAgentResult: (result: unknown) => Promise<EvaluatedRepairResolution>;
};

async function prepareRepairResolutionEvalRun(
  testCase: LegacyReleaseRepairResolutionEvalCase,
): Promise<PreparedRepairResolutionRun> {
  const options = createClassifierOptions();
  const classifier = createBottleClassifier(options);
  const parsedInput = ClassifyBottleReferenceInputSchema.parse(testCase.input);
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
    evaluateAgentResult: async (result) => {
      const reasoning = agentRun.getReasoningResult(result);
      const { decision, artifacts: reasoningArtifacts } =
        await finalizeBottleClassifierReasoningResult({
          options,
          reference: parsedInput.reference,
          reasoning,
          candidateExpansion: parsedInput.candidateExpansion,
          webSearchBudget: agentRun.webSearchBudget,
        });
      const classification = BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision,
          artifacts: reasoningArtifacts,
        }),
      );
      const resolution = resolveLegacyCreateParentClassification({
        classification,
        parentRows: testCase.reviewedParentRows,
      });

      return EvaluatedRepairResolutionSchema.parse({
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
      });
    },
  };
}

type RepairHarnessMetadata = {
  expected: LegacyReleaseRepairResolutionEvalCase["expected"];
};

const preparedRepairRuns = new WeakMap<
  LegacyReleaseRepairResolutionEvalCase,
  Promise<PreparedRepairResolutionRun>
>();

function getPreparedRepairRun(input: LegacyReleaseRepairResolutionEvalCase) {
  let preparedRun = preparedRepairRuns.get(input);
  if (!preparedRun) {
    preparedRun = prepareRepairResolutionEvalRun(input);
    preparedRepairRuns.set(input, preparedRun);
  }

  return preparedRun;
}

const repairHarness = openaiAgentsHarness<
  PreparedBottleClassifierAgentRun["agent"],
  LegacyReleaseRepairResolutionEvalCase,
  RepairHarnessMetadata,
  PreparedBottleClassifierAgentRun["runner"],
  EvaluatedRepairResolution
>({
  name: "legacy-release-repair-resolution",
  createAgent: async ({ input }) =>
    (await getPreparedRepairRun(input)).agentRun.agent,
  createRunner: async ({ input }) =>
    (await getPreparedRepairRun(input)).agentRun.runner,
  prompt: promptEvalJudgeModel,
  runOptions: async ({ input }) => {
    const { maxTurns } = (await getPreparedRepairRun(input)).agentRun
      .runOptions;
    return {
      maxTurns,
      stream: false,
    };
  },
  run: async ({ agent, input, runner, runOptions }) => {
    if (!runner) {
      throw new Error("Repair eval runner was not prepared.");
    }

    const preparedRun = await getPreparedRepairRun(input);
    const result = await runner.run(agent, preparedRun.agentRun.input, {
      ...runOptions,
      stream: false,
    });

    return preparedRun.evaluateAgentResult(result);
  },
  // vitest-evals strict replay intentionally fails when a prompt/tool change
  // makes a new web-search call. Record those new tool results with:
  // VITEST_EVALS_REPLAY_MODE=record pnpm --filter @peated/bottle-classifier evals -- src/legacyReleaseRepairResolution.eval.test.ts
  toolReplay: {
    openai_web_search: true,
    brave_web_search: true,
  },
  normalize: {
    output: ({ result }) => toJsonValue(result) ?? null,
    outputText: ({ result }) => JSON.stringify(result, null, 2),
  },
});

type RepairJudgeContext = JudgeContext<
  LegacyReleaseRepairResolutionEvalCase,
  RepairHarnessMetadata,
  typeof repairHarness
>;

const RepairShapeJudge = namedJudge<RepairJudgeContext>(
  "RepairShapeJudge",
  ({ inputValue, run }) => ({
    score: scoreRepairShape(
      parseRepairRunOutput(run.output),
      inputValue.expected,
    ),
  }),
);

const RepairRubricJudge = namedJudge<RepairJudgeContext>(
  "RepairRubricJudge",
  async ({ inputValue, run }) => {
    const judgement = await judgeRepairCase(
      inputValue,
      parseRepairRunOutput(run.output),
    );

    return {
      score: judgement.score,
      metadata: {
        rationale: judgement.reasoning,
      },
    };
  },
);

describeEval(
  "legacy release repair resolution",
  {
    skipIf: () => !process.env.OPENAI_API_KEY,
    harness: repairHarness,
    judges: [RepairShapeJudge, RepairRubricJudge],
    judgeThreshold: 0.7,
  },
  (it) => {
    const cases = LEGACY_RELEASE_REPAIR_RESOLUTION_EVAL_CASES.map(
      (testCase) => ({
        name: testCase.name,
        testCase,
      }),
    );

    it.for(cases)("$name", async ({ testCase }, { run }) => {
      await run(testCase, {
        metadata: {
          expected: testCase.expected,
        },
      });
    });
  },
);
