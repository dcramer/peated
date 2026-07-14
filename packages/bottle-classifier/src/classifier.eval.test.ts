import { openaiAgentsHarness } from "@vitest-evals/harness-openai-agents";
import { createJudge, describeEval, type JudgeContext } from "vitest-evals";
import { toJsonValue, type JsonValue } from "vitest-evals/harness";
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
  collectInitialResolvedEntities,
  createBottleClassifier,
  finalizeBottleClassifierReasoningResult,
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
import { createEvalClassifierOptions } from "./evalSupport";
import { createLocalCatalogDataSource } from "./localCatalog";
import {
  agentActionRiskClass,
  deriveAutomationTier,
  type AutomationTier,
} from "./priceMatchingEvidence";
import type { RealWorldNewBottleEvalCase } from "./realWorldNewBottleEval.fixtures";
import { getAutoIgnoreBottleReferenceReason } from "./reviewPolicy";
import { buildDefaultBottleSearchInput } from "./runtime/agentInput";
import {
  applyDeterministicIdentitySeed,
  getDeterministicIdentitySeed,
  resolveDeterministicBottleReference,
} from "./runtime/deterministic";

type ClassifiedBottleClassificationResult = Extract<
  BottleClassificationResult,
  { status: "classified" }
>;

function getScenarioEvalName(testCase: ClassifierScenarioEvalCase): string {
  if (testCase.kind === "decision") {
    return testCase.testCase.name;
  }

  return testCase.testCase.input.reference.name;
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

// Derives the code-owned automation tier for an eval result, mirroring the
// production consumers (`deriveAutomationTier`). Numeric confidence and the
// confidence band were removed from the contract, so the tier is derived from
// the action risk class plus the structured evidence and anchors. Photo/image
// fixtures carry primary image evidence; exact-cask identity is the closed-form
// deterministic anchor.
function getDerivedAutomationTier(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
): AutomationTier {
  if (result.status !== "classified") {
    return "review";
  }

  const decision = result.decision;
  const currentBottleId = testCase.input.reference.currentBottleId ?? null;
  const currentReleaseId = testCase.input.reference.currentReleaseId ?? null;
  const reaffirmsCurrentAssignment =
    currentBottleId != null &&
    decision.matchedBottleId === currentBottleId &&
    (decision.matchedReleaseId ?? null) === (currentReleaseId ?? null);

  return deriveAutomationTier({
    actionRiskClass: agentActionRiskClass(decision.action),
    hasUnresolvedRisks:
      (decision.confidenceBasis?.unresolvedRisks.length ?? 0) > 0,
    webEvidence: decision.confidenceBasis?.webEvidence ?? null,
    hasMatchTarget:
      decision.action === "match" && decision.matchedBottleId !== null,
    reaffirmsCurrentAssignment,
    replacesCurrentAssignment:
      currentBottleId != null && !reaffirmsCurrentAssignment,
    matchesFreshReleaseTarget:
      !reaffirmsCurrentAssignment &&
      decision.action === "match" &&
      (decision.matchedReleaseId ?? null) !== null,
    hasExactAliasAnchor: false,
    hasDeterministicAnchor: decision.identityScope === "exact_cask",
    // Image-backed fixtures either pre-seed `input.imageEvidence` or carry only
    // `reference.imageUrl` and rely on live extraction; both mean the run has
    // primary label/image evidence, matching the photo-identification consumer.
    hasPrimaryLabelOrImageEvidence:
      testCase.input.imageEvidence != null ||
      Boolean(testCase.input.reference.imageUrl),
  });
}

function getDerivedVerifyEligibility(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
): boolean {
  if (result.status !== "classified" || result.decision.action !== "match") {
    return false;
  }

  return getDerivedAutomationTier(testCase, result) === "auto";
}

function getDerivedSuggestedNextStep(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
): "confirm_match" | "confirm_create" | "manual_search" | "needs_review" {
  if (result.status === "ignored") {
    return "manual_search";
  }

  const decision = result.decision;
  const tier = getDerivedAutomationTier(testCase, result);
  switch (decision.action) {
    case "match":
      return tier === "auto" ? "confirm_match" : "manual_search";
    case "create_bottle":
    case "create_release":
    case "create_bottle_and_release":
    case "repair_parent_and_create_release":
      return tier === "auto" ? "confirm_create" : "manual_search";
    case "repair_bottle":
      return "needs_review";
    case "no_match":
      return "manual_search";
  }
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

function evalTextContainsStatedAge(value: string, statedAge: number): boolean {
  return new RegExp(`\\b${statedAge}\\s+year\\s+old\\b`).test(
    normalizeEvalText(value),
  );
}

function getProposedBottleIdentityText(
  proposedBottle: NonNullable<
    ClassifiedBottleClassificationResult["decision"]["proposedBottle"]
  >,
): string {
  let identity = [proposedBottle.brand.name, proposedBottle.name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (
    proposedBottle.statedAge !== null &&
    !evalTextContainsStatedAge(identity, proposedBottle.statedAge)
  ) {
    identity = `${identity} ${proposedBottle.statedAge}-year-old`;
  }

  return identity;
}

function normalizeEvalText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && token !== "the")
    .join(" ");
}

function normalizeEvalEditionText(value: string | null | undefined): string {
  const romanNumerals: Record<string, string> = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
  };

  return normalizeEvalText(value)
    .split(" ")
    .flatMap((token) => {
      if (token === "release") return [];
      if (token === "vol") return ["volume"];
      return [romanNumerals[token] ?? token];
    })
    .join(" ");
}

function evalTextMatches(
  actual: string | null | undefined,
  expected: string,
): boolean {
  return normalizeEvalText(actual) === normalizeEvalText(expected);
}

function getNormalizationBottleIdentity(
  result: BottleClassificationResult,
): string | null {
  if (result.status !== "classified") {
    return null;
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

  if (matchedCandidate) {
    return matchedCandidate.bottleFullName ?? matchedCandidate.fullName;
  }

  if (!result.decision.proposedBottle) {
    return null;
  }

  return getProposedBottleIdentityText(result.decision.proposedBottle);
}

function getNormalizationReleaseIdentity(result: BottleClassificationResult): {
  edition: string | null;
  releaseYear: number | null;
  vintageYear: number | null;
} | null {
  if (result.status !== "classified") {
    return null;
  }

  if (result.decision.proposedRelease) {
    return {
      edition: result.decision.proposedRelease.edition,
      releaseYear: result.decision.proposedRelease.releaseYear,
      vintageYear: result.decision.proposedRelease.vintageYear,
    };
  }

  const matchedRelease =
    result.decision.matchedReleaseId !== null
      ? result.artifacts.candidates.find(
          (candidate) =>
            candidate.releaseId === result.decision.matchedReleaseId,
        )
      : null;
  if (!matchedRelease) {
    return null;
  }

  return {
    edition: matchedRelease.edition,
    releaseYear: matchedRelease.releaseYear,
    vintageYear: matchedRelease.vintageYear,
  };
}

function releaseIdentityMatches(
  actual: ReturnType<typeof getNormalizationReleaseIdentity>,
  expected: NonNullable<
    RealWorldNewBottleEvalCase["expected"]["releaseIdentity"]
  >,
): boolean {
  if (actual === null) {
    return false;
  }

  if (
    "edition" in expected &&
    normalizeEvalEditionText(actual.edition) !==
      normalizeEvalEditionText(expected.edition)
  ) {
    return false;
  }

  if (
    "releaseYear" in expected &&
    actual.releaseYear !== expected.releaseYear
  ) {
    return false;
  }

  if (
    "vintageYear" in expected &&
    actual.vintageYear !== expected.vintageYear
  ) {
    return false;
  }

  return true;
}

type ShapeVerdict = {
  score: 0 | 1;
  failures: string[];
};

function getShapeVerdict(failures: string[]): ShapeVerdict {
  return {
    score: failures.length === 0 ? 1 : 0,
    failures,
  };
}

function evaluateDecisionShape(
  testCase: ClassifierEvalCase,
  result: BottleClassificationResult,
): ShapeVerdict {
  const expected = testCase.expected;
  const failures: string[] = [];

  if (result.status !== expected.status) {
    failures.push(
      `status expected ${expected.status} but got ${result.status}`,
    );
    return getShapeVerdict(failures);
  }

  if (expected.status !== "classified") {
    return getShapeVerdict(failures);
  }

  if (result.status !== "classified") {
    return getShapeVerdict(failures);
  }

  if (expected.action === undefined) {
    failures.push("fixture missing expected action for classified case");
  } else if (result.decision.action !== expected.action) {
    failures.push(
      `action expected ${expected.action} but got ${result.decision.action}`,
    );
  }

  if (
    expected.identityScope !== undefined &&
    result.decision.identityScope !== expected.identityScope
  ) {
    failures.push(
      `identityScope expected ${expected.identityScope} but got ${result.decision.identityScope}`,
    );
  }

  if (
    expected.aliasScope !== undefined &&
    result.decision.aliasScope !== expected.aliasScope
  ) {
    failures.push(
      `aliasScope expected ${expected.aliasScope} but got ${result.decision.aliasScope}`,
    );
  }

  if (
    expected.matchedBottleId !== undefined &&
    result.decision.matchedBottleId !== expected.matchedBottleId
  ) {
    failures.push(
      `matchedBottleId expected ${expected.matchedBottleId} but got ${result.decision.matchedBottleId}`,
    );
  }

  if (
    expected.matchedReleaseId !== undefined &&
    result.decision.matchedReleaseId !== expected.matchedReleaseId
  ) {
    failures.push(
      `matchedReleaseId expected ${expected.matchedReleaseId} but got ${result.decision.matchedReleaseId}`,
    );
  }

  if (
    expected.parentBottleId !== undefined &&
    result.decision.parentBottleId !== expected.parentBottleId
  ) {
    failures.push(
      `parentBottleId expected ${expected.parentBottleId} but got ${result.decision.parentBottleId}`,
    );
  }

  if (expected.expectedTier !== undefined) {
    const derivedTier = getDerivedAutomationTier(testCase, result);
    if (derivedTier !== expected.expectedTier) {
      failures.push(
        `expectedTier expected ${expected.expectedTier} but got ${derivedTier}`,
      );
    }
  }

  if (
    expected.verifyEligible !== undefined &&
    getDerivedVerifyEligibility(testCase, result) !== expected.verifyEligible
  ) {
    failures.push(`verifyEligible expected ${expected.verifyEligible}`);
  }

  if (
    expected.suggestedNextStep !== undefined &&
    getDerivedSuggestedNextStep(testCase, result) !== expected.suggestedNextStep
  ) {
    failures.push(
      `suggestedNextStep expected ${expected.suggestedNextStep} but got ${getDerivedSuggestedNextStep(testCase, result)}`,
    );
  }

  if (
    expected.proposedBottle !== undefined &&
    !deepContainsSubset(result.decision.proposedBottle, expected.proposedBottle)
  ) {
    failures.push("proposedBottle missing expected fields");
  }

  if (expected.proposedBottleNameIncludes !== undefined) {
    const proposedBottleName = result.decision.proposedBottle?.name ?? "";
    for (const requiredText of expected.proposedBottleNameIncludes) {
      if (
        !normalizeEvalText(proposedBottleName).includes(
          normalizeEvalText(requiredText),
        )
      ) {
        failures.push(
          `proposedBottle.name expected to include ${requiredText}`,
        );
      }
    }
  }

  if (expected.proposedBottleNameExcludes !== undefined) {
    const proposedBottleName = result.decision.proposedBottle?.name ?? "";
    for (const excludedText of expected.proposedBottleNameExcludes) {
      if (
        normalizeEvalText(proposedBottleName).includes(
          normalizeEvalText(excludedText),
        )
      ) {
        failures.push(
          `proposedBottle.name expected not to include ${excludedText}`,
        );
      }
    }
  }

  if (expected.proposedBottleDistillerIdOneOf !== undefined) {
    const selectedIds =
      result.decision.proposedBottle?.distillers
        .map((distiller) => distiller.id)
        .filter((id): id is number => id !== null) ?? [];
    if (
      !expected.proposedBottleDistillerIdOneOf.some((id) =>
        selectedIds.includes(id),
      )
    ) {
      failures.push(
        `proposedBottle.distillers expected an id in ${expected.proposedBottleDistillerIdOneOf.join(", ")}`,
      );
    }
  }

  if (
    expected.proposedRelease !== undefined &&
    !deepContainsSubset(
      result.decision.proposedRelease,
      expected.proposedRelease,
    )
  ) {
    failures.push("proposedRelease missing expected fields");
  }

  return getShapeVerdict(failures);
}

function evaluateNormalizationShape(
  testCase: RealWorldNewBottleEvalCase,
  result: BottleClassificationResult,
): ShapeVerdict {
  const expectation = testCase.expected;
  const failures: string[] = [];
  const classifierExpectations = expectation.classifierExpectations ?? [
    expectation.classifierExpectation,
  ];

  if (classifierExpectations.includes("review_required")) {
    if (
      result.status !== "ignored" &&
      (result.status !== "classified" || result.decision.action !== "no_match")
    ) {
      failures.push("review_required expected ignored or no_match");
    }

    return getShapeVerdict(failures);
  }

  if (result.status !== "classified") {
    failures.push(`status expected classified but got ${result.status}`);
    return getShapeVerdict(failures);
  }

  const bottleIdentity = getNormalizationBottleIdentity(result);
  const expectedBottleNames = testCase.expectedBottleNames ?? [
    testCase.expectedBottleName,
  ];
  if (
    !expectedBottleNames.some((expectedBottleName) =>
      evalTextMatches(bottleIdentity, expectedBottleName),
    )
  ) {
    failures.push(
      `bottle identity expected ${expectedBottleNames.join(" or ")} but got ${bottleIdentity ?? "missing"}`,
    );
  }

  const releaseIdentity = getNormalizationReleaseIdentity(result);

  if (classifierExpectations.includes("exact_cask")) {
    if (result.decision.identityScope !== "exact_cask") {
      failures.push(
        `identityScope expected exact_cask but got ${result.decision.identityScope}`,
      );
    }

    if (releaseIdentity !== null) {
      failures.push("exact_cask expected no child release identity");
    }

    return getShapeVerdict(failures);
  }

  if (classifierExpectations.includes("bottle_plus_release")) {
    const hasReleaseAction =
      result.decision.action === "create_release" ||
      result.decision.action === "create_bottle_and_release" ||
      result.decision.matchedReleaseId !== null;

    if (!hasReleaseAction && classifierExpectations.includes("bottle")) {
      return getShapeVerdict(failures);
    }

    if (result.decision.identityScope !== "product") {
      failures.push(
        `identityScope expected product but got ${result.decision.identityScope}`,
      );
    }

    if (!hasReleaseAction) {
      failures.push("expected a release match or release creation action");
    }

    const releaseIdentityOptions =
      expectation.releaseIdentities ??
      (expectation.releaseIdentity !== null
        ? [expectation.releaseIdentity]
        : []);

    if (releaseIdentityOptions.length === 0) {
      failures.push("fixture missing expected release identity");
    } else if (
      !releaseIdentityOptions.some((expectedReleaseIdentity) =>
        releaseIdentityMatches(releaseIdentity, expectedReleaseIdentity),
      )
    ) {
      failures.push("release identity did not match expected edition/year");
    }

    return getShapeVerdict(failures);
  }

  if (result.decision.identityScope !== "product") {
    failures.push(
      `identityScope expected product but got ${result.decision.identityScope}`,
    );
  }

  if (
    result.decision.action === "create_release" ||
    result.decision.action === "create_bottle_and_release" ||
    result.decision.matchedReleaseId !== null ||
    releaseIdentity !== null
  ) {
    failures.push("bottle fixture should not create or match a child release");
  }

  return getShapeVerdict(failures);
}

function parseClassificationRunOutput(
  output: unknown,
): BottleClassificationResult {
  return BottleClassificationResultSchema.parse(output);
}

function buildClassifierAdapters(testCase: ClassifierScenarioEvalCase) {
  if (testCase.kind === "decision" && testCase.testCase.localCatalog) {
    return createLocalCatalogDataSource(testCase.testCase.localCatalog);
  }

  // Legacy and captured fixtures still use flattened candidate/search
  // responses. Keep them on the agent's local-search tool path instead of a
  // searchless harness so replayed workflows still reflect agent behavior.
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
  deterministicResult?: BottleClassificationResult;
  classifyAgentResult: (result: unknown) => Promise<BottleClassificationResult>;
};

async function prepareScenarioClassifierRun(
  testCase: ClassifierScenarioEvalCase,
): Promise<PreparedScenarioClassifierRun> {
  const options = createClassifierOptions(testCase);
  const dataSource = options.dataSource ?? options.adapters;
  if (!dataSource) {
    throw new Error("Classifier eval requires a data source.");
  }
  const classifier = createBottleClassifier(options);
  const parsedInput = ClassifyBottleReferenceInputSchema.parse(
    testCase.testCase.input,
  );
  const deterministicIdentitySeed = getDeterministicIdentitySeed(
    parsedInput.reference,
  );
  const rawExtractedIdentity =
    parsedInput.extractedIdentity !== undefined
      ? (parsedInput.extractedIdentity ?? deterministicIdentitySeed)
      : (deterministicIdentitySeed ??
        (await classifier.extractBottleReferenceIdentity(
          parsedInput.reference,
        )));
  const extractedIdentity = applyDeterministicIdentitySeed({
    reference: parsedInput.reference,
    extractedIdentity: rawExtractedIdentity,
  });
  const imageEvidence = parsedInput.imageEvidence ?? null;
  const initialArtifacts = buildBottleClassificationArtifacts({
    extractedIdentity,
    imageEvidence,
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
    (dataSource.findInitialCandidates
      ? await dataSource.findInitialCandidates({
          reference: parsedInput.reference,
          extractedIdentity,
        })
      : await dataSource.searchBottles(
          buildDefaultBottleSearchInput({
            reference: parsedInput.reference,
            extractedIdentity,
          }),
        ));
  const artifacts = buildBottleClassificationArtifacts({
    extractedIdentity,
    imageEvidence,
    candidates,
  });
  const deterministicDecision = resolveDeterministicBottleReference({
    reference: parsedInput.reference,
    artifacts,
  });
  const deterministicResult = deterministicDecision
    ? BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision: deterministicDecision,
          artifacts,
        }),
      )
    : undefined;

  const resolvedEntities = await collectInitialResolvedEntities({
    candidateExpansion: parsedInput.candidateExpansion,
    extractedIdentity,
    initialCandidates: artifacts.candidates,
    options,
  });

  const agentRun = await prepareBottleClassifierAgentRun(options, {
    reference: parsedInput.reference,
    extractedIdentity: artifacts.extractedIdentity,
    imageEvidence: artifacts.imageEvidence,
    initialCandidates: artifacts.candidates,
    candidateExpansion: parsedInput.candidateExpansion,
    resolvedEntities,
  });

  return {
    agentRun,
    deterministicResult,
    classifyAgentResult: async (result) => {
      const reasoning = agentRun.getReasoningResult(result);
      const { decision, artifacts: reasoningArtifacts } =
        await finalizeBottleClassifierReasoningResult({
          reference: parsedInput.reference,
          reasoning,
        });

      return BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision,
          artifacts: reasoningArtifacts,
        }),
      );
    },
  };
}

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
  PreparedBottleClassifierAgentRun["runner"],
  BottleClassificationResult,
  unknown,
  JsonValue
>({
  name: "bottle-classifier",
  agent: async ({ input }) =>
    (await getPreparedClassifierRun(input)).agentRun.agent,
  runner: async ({ input }) =>
    (await getPreparedClassifierRun(input)).agentRun.runner,
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
    if (preparedRun.deterministicResult) {
      return preparedRun.deterministicResult;
    }

    const result = await runner.run(agent, preparedRun.agentRun.input, {
      ...runOptions,
      stream: false,
    });

    return preparedRun.classifyAgentResult(result);
  },
  output: ({ result }) => {
    return toJsonValue(result) ?? null;
  },
  // vitest-evals strict replay intentionally fails when a prompt/tool change
  // makes a new web-search call. Record those new tool results with:
  // VITEST_EVALS_REPLAY_MODE=record pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts
  // The harness rejects replay policies for tools absent from the prepared
  // agent, so keep this aligned with Firecrawl-vs-OpenAI tool selection.
  toolReplay: {
    ...(process.env.FIRECRAWL_API_KEY
      ? { firecrawl_web_search: true }
      : { openai_web_search: true }),
  },
});

type ClassifierJudgeContext = JudgeContext<
  ClassifierScenarioEvalCase,
  JsonValue,
  typeof classifierHarness
>;

const ClassifierExpectationJudge = createJudge<ClassifierJudgeContext>(
  "ClassifierExpectationJudge",
  ({ input, run }) => {
    const result = parseClassificationRunOutput(run.output);
    const verdict =
      input.kind === "new_bottle_fixture"
        ? evaluateNormalizationShape(input.testCase, result)
        : evaluateDecisionShape(input.testCase, result);

    return {
      score: verdict.score,
      metadata: {
        rationale:
          verdict.failures.join("; ") || "All expected fields matched.",
        failures: verdict.failures,
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
    threshold: 1,
  },
  {
    label: "match existing",
    scenario: "match_existing",
    threshold: 1,
  },
  {
    label: "corrections",
    scenario: "corrections",
    threshold: 1,
  },
  {
    label: "parent repair releases",
    scenario: "parent_repair_releases",
    threshold: 1,
  },
];

for (const { label, scenario, threshold } of SCENARIO_CONFIG) {
  const cases = getClassifierLiveEvalCases(scenario).map((testCase) => ({
    name: getScenarioEvalName(testCase),
    testCase,
  }));

  describeEval(
    label,
    {
      skipIf: () => !process.env.OPENAI_API_KEY,
      harness: classifierHarness,
      judges: [ClassifierExpectationJudge],
      judgeThreshold: threshold,
    },
    (it) => {
      it.for(cases)("$name", async ({ testCase }, { run }) => {
        await run(testCase);
      });
    },
  );
}
