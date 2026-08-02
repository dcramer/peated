import { expect } from "vitest";
import {
  createHarness,
  createJudge,
  describeEval,
  type JudgeContext,
} from "vitest-evals";
import {
  toJsonValue,
  type JsonValue,
  type TranscriptEvent,
} from "vitest-evals/harness";
import { executeWithReplay } from "vitest-evals/replay";
import { AUDIT_BOTTLE_EVAL_CASES } from "./auditBottle.eval.fixtures";
import {
  scoreBottleCheckGrounding,
  scoreBottleCheckSemanticOutput,
} from "./bottleCheckEvalScoring";
import {
  BottleContextSchema,
  EntityContextSchema,
  type EntityContext,
} from "./bottleContextContract";
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
  type BottleClassifierDataSource,
  type BottleClassifierToolEvent,
  type CreateBottleClassifierOptions,
} from "./classifierRuntime";
import type { BottleCandidate, EntityResolution } from "./classifierTypes";
import {
  AuditBottleResultSchema,
  BottleClassificationResultSchema,
  getBottleCheckSourceEvidencePaths,
  type BottleClassificationResult,
} from "./contract";
import type { AuditBottleEvalFixture } from "./evalFixtureSchemas";
import {
  buildEvalHarnessMeasurements,
  formatEvalUsageAnnotation,
} from "./evalMeasurements";
import {
  assertSuccessfulWebSearchReplay,
  sanitizeWebSearchRecording,
} from "./evalReplay";
import {
  createEvalClassifierOptions,
  evalClassifierModel,
  evalClassifierReasoningEffort,
  hasEvalOpenAICredentials,
} from "./evalSupport";
import { createLocalCatalogDataSource } from "./localCatalog";
import { exactBottleIdentityMatches } from "./normalizationEvalScoring";
import {
  agentActionRiskClass,
  deriveAutomationTier,
  type AutomationTier,
} from "./priceMatchingEvidence";
import type { RealWorldNewBottleEvalCase } from "./realWorldNewBottleEval.fixtures";

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
  const knownCandidates = new Map<number, BottleCandidate>();

  for (const candidate of testCase.input.initialCandidates ?? []) {
    knownCandidates.set(candidate.bottleId, candidate);
  }

  for (const response of testCase.searchResponses ?? []) {
    for (const candidate of response.results) {
      knownCandidates.set(candidate.bottleId, candidate);
    }
  }

  return Array.from(knownCandidates.values());
}

function buildSearchBottlesAdapter(
  testCase: Pick<SearchFixtureCase, "searchResponses">,
) {
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
  const reaffirmsCurrentAssignment =
    currentBottleId != null && decision.matchedBottleId === currentBottleId;

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

  const matchedCandidate = result.artifacts.candidates.find(
    (candidate) => candidate.bottleId === result.decision.matchedBottleId,
  );

  if (matchedCandidate) {
    return matchedCandidate.fullName;
  }

  if (!result.decision.proposedBottle) {
    return null;
  }

  return getProposedBottleIdentityText(result.decision.proposedBottle);
}

function getNormalizationExactBottleIdentity(
  result: BottleClassificationResult,
): {
  edition: string | null;
  releaseYear: number | null;
  vintageYear: number | null;
} | null {
  if (result.status !== "classified") {
    return null;
  }

  if (result.decision.proposedBottle) {
    const exactIdentity = {
      edition: result.decision.proposedBottle.edition,
      releaseYear: result.decision.proposedBottle.releaseYear,
      vintageYear: result.decision.proposedBottle.vintageYear,
    };

    return Object.values(exactIdentity).some((value) => value !== null)
      ? exactIdentity
      : null;
  }

  const matchedCandidate = result.artifacts.candidates.find(
    (candidate) => candidate.bottleId === result.decision.matchedBottleId,
  );
  if (!matchedCandidate) {
    return null;
  }

  return {
    edition: matchedCandidate.edition,
    releaseYear: matchedCandidate.releaseYear,
    vintageYear: matchedCandidate.vintageYear,
  };
}

function formatNormalizationBottleActual(
  result: BottleClassificationResult,
): string {
  if (result.status !== "classified") {
    return JSON.stringify({ status: result.status });
  }

  const exactIdentity = getNormalizationExactBottleIdentity(result);
  if (result.decision.proposedBottle) {
    return JSON.stringify({
      source: "proposed",
      action: result.decision.action,
      identity: getProposedBottleIdentityText(result.decision.proposedBottle),
      exactIdentity,
      proposedBottle: result.decision.proposedBottle,
    });
  }

  const matchedBottle = result.artifacts.candidates.find(
    (candidate) => candidate.bottleId === result.decision.matchedBottleId,
  );
  return JSON.stringify({
    source: "matched",
    action: result.decision.action,
    matchedBottleId: result.decision.matchedBottleId,
    identity: matchedBottle?.fullName ?? null,
    exactIdentity,
    matchedBottle: matchedBottle
      ? {
          bottleId: matchedBottle.bottleId,
          fullName: matchedBottle.fullName,
        }
      : null,
  });
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

  const actualBottle = formatNormalizationBottleActual(result);
  if (
    expectation.action !== undefined &&
    result.decision.action !== expectation.action
  ) {
    failures.push(
      `action expected ${expectation.action} but got ${result.decision.action}; actual finalized Bottle ${actualBottle}`,
    );
  }
  if (
    expectation.matchedBottleId !== undefined &&
    result.decision.matchedBottleId !== expectation.matchedBottleId
  ) {
    failures.push(
      `matchedBottleId expected ${expectation.matchedBottleId} but got ${result.decision.matchedBottleId}; actual finalized Bottle ${actualBottle}`,
    );
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
      `bottle identity expected ${expectedBottleNames.join(" or ")}; actual finalized Bottle ${actualBottle}`,
    );
  }

  const exactBottleIdentity = getNormalizationExactBottleIdentity(result);

  if (classifierExpectations.includes("exact_cask")) {
    if (result.decision.identityScope !== "exact_cask") {
      failures.push(
        `identityScope expected exact_cask but got ${result.decision.identityScope}`,
      );
    }

    return getShapeVerdict(failures);
  }

  const exactIdentityOptions =
    expectation.exactBottleIdentities ??
    (expectation.exactBottleIdentity !== null
      ? [expectation.exactBottleIdentity]
      : []);
  if (exactIdentityOptions.length > 0) {
    if (result.decision.identityScope !== "product") {
      failures.push(
        `identityScope expected product but got ${result.decision.identityScope}`,
      );
    }

    if (
      !exactIdentityOptions.some((expectedExactIdentity) =>
        exactBottleIdentityMatches(exactBottleIdentity, expectedExactIdentity),
      )
    ) {
      failures.push(
        `exact Bottle identity expected one of ${JSON.stringify(exactIdentityOptions)}; actual finalized Bottle ${actualBottle}`,
      );
    }

    return getShapeVerdict(failures);
  }

  if (result.decision.identityScope !== "product") {
    failures.push(
      `identityScope expected product but got ${result.decision.identityScope}`,
    );
  }

  return getShapeVerdict(failures);
}

function parseClassificationRunOutput(
  output: unknown,
): BottleClassificationResult {
  return BottleClassificationResultSchema.parse(output);
}

function buildClassifierAdapters(
  testCase: ClassifierScenarioEvalCase,
): BottleClassifierDataSource {
  // Captured fixtures use Bottle candidate/search responses. Keep them on the
  // local-search tool path so replayed workflows still reflect agent behavior.
  const knownCandidates = collectKnownCandidates(testCase.testCase);
  const baseDataSource =
    testCase.kind === "decision" && testCase.testCase.localCatalog
      ? createLocalCatalogDataSource(testCase.testCase.localCatalog)
      : {
          searchBottles: buildSearchBottlesAdapter(testCase.testCase),
          getBottleCandidateById: async (bottleId: number) =>
            knownCandidates.find(
              (candidate) => candidate.bottleId === bottleId,
            ) ?? null,
        };
  if (testCase.kind !== "decision") {
    return baseDataSource;
  }

  const { inspectedBottleIds, inspectedEntities } = testCase.testCase.context;
  const inspectedBottleIdSet = new Set(inspectedBottleIds);
  const entityContexts = new Map(
    inspectedEntities.map((entity) => [
      entity.entityId,
      auditEntityContext(entity),
    ]),
  );
  return {
    ...baseDataSource,
    ...(inspectedBottleIdSet.size > 0
      ? {
          getBottleContext: async (bottleId: number) => {
            return (
              testCase.testCase.context.bottleContexts?.find(
                (context) => context.bottleId === bottleId,
              ) ?? null
            );
          },
        }
      : {}),
    ...(entityContexts.size > 0
      ? {
          getEntityContext: async (entityId: number) =>
            entityContexts.get(entityId) ?? null,
        }
      : {}),
  };
}

function createClassifierOptions(testCase: ClassifierScenarioEvalCase) {
  return createEvalClassifierOptions(buildClassifierAdapters(testCase));
}

function createEvalRuntime() {
  const toolEvents: TranscriptEvent[] = [];
  const options: Pick<
    CreateBottleClassifierOptions,
    "executeWebSearch" | "observeToolEvent"
  > = {
    executeWebSearch: async ({ toolName, args, execute }) => {
      const { result } = await executeWithReplay({
        toolName,
        args,
        context: null,
        execute,
        replay: { sanitize: sanitizeWebSearchRecording },
      });
      assertSuccessfulWebSearchReplay(result);
      return result;
    },
    observeToolEvent: (event: BottleClassifierToolEvent) => {
      if (event.type === "tool_call") {
        const args = toJsonValue(event.arguments);
        toolEvents.push({
          type: "tool_call",
          id: event.id,
          name: event.name,
          metadata: { phase: event.phase },
          ...(args && typeof args === "object" && !Array.isArray(args)
            ? { arguments: args }
            : {}),
        });
        return;
      }

      toolEvents.push({
        type: "tool_result",
        toolCallId: event.toolCallId,
        name: event.name,
        content: toJsonValue(event.result) ?? null,
        metadata: { phase: event.phase },
      });
    },
  };

  return {
    toolEvents,
    options,
  };
}

const classifierHarness = createHarness<ClassifierScenarioEvalCase, JsonValue>({
  name: "bottle-classifier",
  run: async ({ input }) => {
    const startedAt = performance.now();
    const evalRuntime = createEvalRuntime();
    const classifier = createBottleClassifier({
      ...createClassifierOptions(input),
      ...evalRuntime.options,
    });
    const { result, modelMetadata } = await classifier.runBottleReference(
      input.testCase.input,
    );
    const output = toJsonValue(result) ?? null;

    return {
      output,
      events: [
        {
          type: "message",
          role: "user",
          content: toJsonValue(input.testCase.input) ?? null,
        },
        ...evalRuntime.toolEvents,
        { type: "message", role: "assistant", content: output },
      ],
      ...buildEvalHarnessMeasurements({
        model: evalClassifierModel,
        modelMetadata,
        reasoningEffort: evalClassifierReasoningEffort,
        totalMs: performance.now() - startedAt,
      }),
    };
  },
});

function auditEntityContext(entity: EntityResolution): EntityContext {
  return EntityContextSchema.parse({
    entityId: entity.entityId,
    name: entity.name,
    shortName: entity.shortName,
    roles: entity.type,
    website: null,
    country: null,
    region: null,
    yearEstablished: null,
    aliases: entity.alias ? [entity.alias] : [],
    relatedBottles: [],
  });
}

function createAuditEvalClassifierOptions(testCase: AuditBottleEvalFixture) {
  const { currentBottle, inspectedBottles, inspectedEntities } =
    testCase.input.context;
  const bottleContexts = new Map(
    testCase.input.context.bottleContexts.map((context) => [
      context.bottleId,
      context,
    ]),
  );
  const entityContexts = new Map(
    inspectedEntities.map((entity) => [
      entity.entityId,
      auditEntityContext(entity),
    ]),
  );
  const entitySearch = createLocalCatalogDataSource({
    entities: inspectedEntities.map((entity) => ({
      id: entity.entityId,
      name: entity.name,
      shortName: entity.shortName,
      aliases: entity.alias ? [entity.alias] : [],
      type: entity.type,
    })),
    bottles: [],
    aliases: [],
  }).searchEntities;

  return createEvalClassifierOptions({
    searchBottles: buildSearchBottlesAdapter(testCase),
    getBottleCandidateById: async (bottleId) =>
      [currentBottle, ...inspectedBottles].find(
        (candidate) => candidate.bottleId === bottleId,
      ) ?? null,
    getBottleContext: async (bottleId) => bottleContexts.get(bottleId) ?? null,
    searchEntities: entitySearch,
    getEntityContext: async (entityId) => entityContexts.get(entityId) ?? null,
  });
}

const auditHarness = createHarness<AuditBottleEvalFixture, JsonValue>({
  name: "bottle-auditor",
  run: async ({ input }) => {
    const startedAt = performance.now();
    const evalRuntime = createEvalRuntime();
    const classifier = createBottleClassifier({
      ...createAuditEvalClassifierOptions(input),
      ...evalRuntime.options,
    });
    const { result, modelMetadata } = await classifier.runBottleAudit(
      input.input.audit,
    );
    const output = toJsonValue(result) ?? null;

    return {
      output,
      events: [
        {
          type: "message",
          role: "user",
          content: toJsonValue(input.input.audit) ?? null,
        },
        ...evalRuntime.toolEvents,
        { type: "message", role: "assistant", content: output },
      ],
      ...buildEvalHarnessMeasurements({
        model: evalClassifierModel,
        modelMetadata,
        reasoningEffort: evalClassifierReasoningEffort,
        totalMs: performance.now() - startedAt,
      }),
    };
  },
});

type AuditJudgeContext = JudgeContext<
  AuditBottleEvalFixture,
  JsonValue,
  typeof auditHarness
>;

function scoreAuditSemanticOutput(
  input: AuditBottleEvalFixture,
  output: unknown,
) {
  return scoreBottleCheckSemanticOutput(
    input.expected,
    AuditBottleResultSchema.parse(output),
  );
}

const AuditGroundingJudge = createJudge<AuditJudgeContext>(
  "AuditGroundingJudge",
  ({ input, run }) => {
    const result = AuditBottleResultSchema.parse(run.output);
    const score = scoreBottleCheckGrounding(
      result,
      getBottleCheckSourceEvidencePaths({
        intent: "audit_bottle",
        input: input.input.audit,
        artifacts: result.artifacts,
      }),
      input.requireExpectedOperationEvidence
        ? input.expected.proposedOperations
        : undefined,
    );
    return { score: score.score, metadata: score };
  },
);

const AuditOperationExpectationJudge = createJudge<AuditJudgeContext>(
  "AuditOperationExpectationJudge",
  ({ input, run }) => {
    const score = scoreAuditSemanticOutput(input, run.output).operations;
    return { score: score.score, metadata: score };
  },
);

const AuditFindingExpectationJudge = createJudge<AuditJudgeContext>(
  "AuditFindingExpectationJudge",
  ({ input, run }) => {
    const score = scoreAuditSemanticOutput(input, run.output).findings;
    return { score: score.score, metadata: score };
  },
);

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

function scoreScenarioSemanticOutput(
  input: ClassifierScenarioEvalCase,
  result: BottleClassificationResult,
) {
  const expected =
    input.kind === "decision"
      ? input.testCase.expected
      : { proposedOperations: [], findings: [] };
  const actual =
    result.status === "classified"
      ? result
      : { proposedOperations: [], findings: [] };

  return scoreBottleCheckSemanticOutput(expected, actual);
}

const ClassifierGroundingJudge = createJudge<ClassifierJudgeContext>(
  "ClassifierGroundingJudge",
  ({ input, run }) => {
    const result = parseClassificationRunOutput(run.output);
    const score = scoreBottleCheckGrounding(
      result,
      getBottleCheckSourceEvidencePaths({
        intent: "resolve_reference",
        input: input.testCase.input,
        artifacts: result.artifacts,
      }),
      input.kind === "decision"
        ? input.testCase.expected.proposedOperations
        : undefined,
    );
    return { score: score.score, metadata: score };
  },
);

const OperationExpectationJudge = createJudge<ClassifierJudgeContext>(
  "OperationExpectationJudge",
  ({ input, run }) => {
    const result = parseClassificationRunOutput(run.output);
    const score = scoreScenarioSemanticOutput(input, result).operations;

    return {
      score: score.score,
      metadata: score,
    };
  },
);

const FindingExpectationJudge = createJudge<ClassifierJudgeContext>(
  "FindingExpectationJudge",
  ({ input, run }) => {
    const result = parseClassificationRunOutput(run.output);
    const score = scoreScenarioSemanticOutput(input, result).findings;

    return {
      score: score.score,
      metadata: score,
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
    label: "ignored / no match",
    scenario: "ignore_or_reject",
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
      skipIf: () => !hasEvalOpenAICredentials,
      harness: classifierHarness,
      judges: [ClassifierExpectationJudge, ClassifierGroundingJudge],
      judgeThreshold: threshold,
    },
    (it) => {
      it.for(cases)("$name", async ({ testCase }, { run, annotate }) => {
        const result = await run(testCase);
        await annotate(formatEvalUsageAnnotation(result.usage), "usage");

        await expect(result).toSatisfyJudge(OperationExpectationJudge, {
          threshold: null,
        });
        await expect(result).toSatisfyJudge(FindingExpectationJudge, {
          threshold: null,
        });
      });
    },
  );
}

describeEval(
  "bottle audits",
  {
    skipIf: () => !hasEvalOpenAICredentials,
    harness: auditHarness,
    judges: [
      AuditGroundingJudge,
      AuditOperationExpectationJudge,
      AuditFindingExpectationJudge,
    ],
    judgeThreshold: 1,
  },
  (it) => {
    it.for(
      AUDIT_BOTTLE_EVAL_CASES.map((testCase) => ({
        name: testCase.name,
        testCase,
      })),
    )("$name", async ({ testCase }, { run, annotate }) => {
      const result = await run(testCase);
      await annotate(formatEvalUsageAnnotation(result.usage), "usage");
    });
  },
);
