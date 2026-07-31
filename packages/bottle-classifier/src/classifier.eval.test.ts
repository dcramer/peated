import { openaiAgentsHarness } from "@vitest-evals/harness-openai-agents";
import { createJudge, describeEval, type JudgeContext } from "vitest-evals";
import { toJsonValue, type JsonValue } from "vitest-evals/harness";
import {
  AUDIT_BOTTLE_EVAL_CASES,
  buildAuditEvalBottleContext,
  getAuditEvalBottleContexts,
} from "./auditBottle.eval.fixtures";
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
  collectInitialResolvedEntities,
  createBottleClassifier,
  createBottleContextLoader,
  finalizeBottleClassifierReasoningResult,
  prepareBottleAuditAgentRun,
  prepareBottleClassifierAgentRun,
  type BottleClassifierDataSource,
  type PreparedBottleAuditAgentRun,
  type PreparedBottleClassifierAgentRun,
} from "./classifierRuntime";
import type {
  BottleCandidate,
  CaskFill,
  CaskSize,
  CaskType,
  EntityResolution,
} from "./classifierTypes";
import {
  AuditBottleResultSchema,
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
  createDecidedBottleClassification,
  type AuditBottleResult,
  type BottleClassificationResult,
} from "./contract";
import type { AuditBottleEvalFixture } from "./evalFixtureSchemas";
import {
  createEvalClassifierOptions,
  hasEvalOpenAICredentials,
} from "./evalSupport";
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
  caskType: CaskType | null;
  caskSize: CaskSize | null;
  caskFill: CaskFill | null;
} | null {
  if (result.status !== "classified") {
    return null;
  }

  if (result.decision.proposedBottle) {
    const exactIdentity = {
      edition: result.decision.proposedBottle.edition,
      releaseYear: result.decision.proposedBottle.releaseYear,
      vintageYear: result.decision.proposedBottle.vintageYear,
      caskType: result.decision.proposedBottle.caskType,
      caskSize: result.decision.proposedBottle.caskSize,
      caskFill: result.decision.proposedBottle.caskFill,
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
    caskType: matchedCandidate.caskType,
    caskSize: matchedCandidate.caskSize,
    caskFill: matchedCandidate.caskFill,
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

function exactBottleIdentityMatches(
  actual: ReturnType<typeof getNormalizationExactBottleIdentity>,
  expected: NonNullable<
    RealWorldNewBottleEvalCase["expected"]["exactBottleIdentity"]
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

  if ("caskType" in expected && actual.caskType !== expected.caskType) {
    return false;
  }

  if ("caskSize" in expected && actual.caskSize !== expected.caskSize) {
    return false;
  }

  if ("caskFill" in expected && actual.caskFill !== expected.caskFill) {
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

  const { inspectedBottleIds, inspectedEntities, inspectedSeries } =
    testCase.testCase.context;
  const inspectedBottleIdSet = new Set(inspectedBottleIds);
  const entityContexts = new Map(
    inspectedEntities.map((entity) => [
      entity.entityId,
      auditEntityContext(entity),
    ]),
  );
  const getBottleCandidateById =
    baseDataSource.getBottleCandidateById ??
    (async (bottleId: number) =>
      knownCandidates.find((candidate) => candidate.bottleId === bottleId) ??
      null);

  return {
    ...baseDataSource,
    ...(inspectedBottleIdSet.size > 0
      ? {
          getBottleContext: async (bottleId: number) => {
            if (!inspectedBottleIdSet.has(bottleId)) {
              return null;
            }
            const candidate = await getBottleCandidateById(bottleId);
            return candidate
              ? buildAuditEvalBottleContext(
                  candidate,
                  inspectedEntities,
                  inspectedSeries,
                )
              : null;
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
  const availableOperations =
    testCase.kind === "decision" ? testCase.testCase.availableOperations : [];
  const deterministicResult =
    deterministicDecision && availableOperations.length === 0
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
    availableOperations,
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
      const {
        decision,
        proposedOperations,
        findings,
        artifacts: reasoningArtifacts,
      } = await finalizeBottleClassifierReasoningResult({
        reference: parsedInput.reference,
        reasoning,
      });

      return BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision,
          proposedOperations,
          findings,
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
  unknown,
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

    return result;
  },
  output: async ({ input, result }) => {
    const preparedRun = await getPreparedClassifierRun(input);
    const classification = preparedRun.deterministicResult
      ? BottleClassificationResultSchema.parse(result)
      : await preparedRun.classifyAgentResult(result);

    return toJsonValue(classification) ?? null;
  },
  // The harness rejects replay policies for tools absent from the prepared
  // agent, so keep this aligned with Firecrawl-vs-OpenAI tool selection.
  toolReplay: {
    ...(process.env.FIRECRAWL_API_KEY
      ? { firecrawl_web_search: true }
      : { openai_web_search: true }),
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
  const contextSources = getAuditEvalBottleContexts(testCase);
  const bottleContexts = new Map(
    contextSources.map((context) => [context.bottleId, context]),
  );
  const entityContexts = new Map(
    inspectedEntities.map((entity) => [
      entity.entityId,
      auditEntityContext(entity),
    ]),
  );

  return createEvalClassifierOptions({
    searchBottles: async () => [currentBottle, ...inspectedBottles],
    getBottleCandidateById: async (bottleId) =>
      [currentBottle, ...inspectedBottles].find(
        (candidate) => candidate.bottleId === bottleId,
      ) ?? null,
    getBottleContext: async (bottleId) => bottleContexts.get(bottleId) ?? null,
    searchEntities: async () => inspectedEntities,
    getEntityContext: async (entityId) => entityContexts.get(entityId) ?? null,
  });
}

type PreparedAuditEvalRun = {
  agentRun: PreparedBottleAuditAgentRun;
  getResult: (result: unknown) => AuditBottleResult;
};

const preparedAuditRuns = new WeakMap<
  AuditBottleEvalFixture,
  Promise<PreparedAuditEvalRun>
>();

async function prepareAuditEvalRun(
  testCase: AuditBottleEvalFixture,
): Promise<PreparedAuditEvalRun> {
  const options = createAuditEvalClassifierOptions(testCase);
  const dataSource = options.dataSource ?? options.adapters;
  if (!dataSource) {
    throw new Error("Bottle audit eval requires a data source.");
  }
  const loadBottleContext = createBottleContextLoader({
    dataSource,
    options,
  });
  if (!loadBottleContext) {
    throw new Error("Bottle audit eval requires Bottle context loading.");
  }
  const currentBottleContext = await loadBottleContext(
    testCase.input.audit.bottleId,
  );
  if (!currentBottleContext) {
    throw new Error(
      "Audit eval fixture is missing its current Bottle context.",
    );
  }
  const agentRun = prepareBottleAuditAgentRun(options, {
    audit: testCase.input.audit,
    availableOperations: [
      "update_bottle",
      "merge_bottles",
      "update_entity",
      "merge_entities",
    ],
    currentBottleContext,
    conversationId: `bottle_audit_eval:${testCase.id}`,
    searchEvidence: testCase.input.context.searchEvidence,
  });
  const prepared = {
    agentRun,
    getResult: (result: unknown) =>
      createAuditBottleResult({
        ...agentRun.getOutput(result),
        artifacts: agentRun.getArtifacts(),
      }),
  };
  return prepared;
}

function getPreparedAuditRun(
  testCase: AuditBottleEvalFixture,
): Promise<PreparedAuditEvalRun> {
  const existing = preparedAuditRuns.get(testCase);
  if (existing) {
    return existing;
  }

  const prepared = prepareAuditEvalRun(testCase);
  preparedAuditRuns.set(testCase, prepared);
  return prepared;
}

const auditHarness = openaiAgentsHarness<
  PreparedBottleAuditAgentRun["agent"],
  AuditBottleEvalFixture,
  PreparedBottleAuditAgentRun["runner"],
  unknown,
  unknown,
  JsonValue
>({
  name: "bottle-auditor",
  agent: async ({ input }) => (await getPreparedAuditRun(input)).agentRun.agent,
  runner: async ({ input }) =>
    (await getPreparedAuditRun(input)).agentRun.runner,
  runOptions: async ({ input }) => ({
    ...(await getPreparedAuditRun(input)).agentRun.runOptions,
    stream: false,
  }),
  run: async ({ agent, input, runner, runOptions }) => {
    if (!runner) {
      throw new Error("Bottle audit eval runner was not prepared.");
    }
    const prepared = await getPreparedAuditRun(input);
    return await runner.run(agent, prepared.agentRun.input, {
      ...runOptions,
      stream: false,
    });
  },
  output: async ({ input, result }) =>
    toJsonValue((await getPreparedAuditRun(input)).getResult(result)) ?? null,
  toolReplay: {
    ...(process.env.FIRECRAWL_API_KEY
      ? { firecrawl_web_search: true }
      : { openai_web_search: true }),
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
    const score = scoreBottleCheckGrounding(
      AuditBottleResultSchema.parse(run.output),
      input.input.audit.note === undefined ? [] : ["audit.note"],
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

function getScenarioSourceFields(
  input: ClassifierScenarioEvalCase,
  result: BottleClassificationResult,
) {
  const sourceFields = new Set<string>();
  for (const [field, value] of Object.entries(input.testCase.input.reference)) {
    if (value !== null && value !== undefined) {
      sourceFields.add(`reference.${field}`);
    }
  }
  for (const [field, value] of Object.entries(
    result.artifacts.extractedIdentity ?? {},
  )) {
    if (value !== null && value !== undefined) {
      sourceFields.add(`extractedIdentity.${field}`);
    }
  }
  for (const field of Object.keys(
    result.artifacts.imageEvidence?.fieldCandidates ?? {},
  )) {
    sourceFields.add(`imageEvidence.fieldCandidates.${field}`);
  }
  return [...sourceFields];
}

const ClassifierGroundingJudge = createJudge<ClassifierJudgeContext>(
  "ClassifierGroundingJudge",
  ({ input, run }) => {
    const result = parseClassificationRunOutput(run.output);
    const score = scoreBottleCheckGrounding(
      result,
      getScenarioSourceFields(input, result),
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
      judges: [
        ClassifierExpectationJudge,
        ClassifierGroundingJudge,
        OperationExpectationJudge,
        FindingExpectationJudge,
      ],
      judgeThreshold: threshold,
    },
    (it) => {
      it.for(cases)("$name", async ({ testCase }, { run }) => {
        await run(testCase);
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
    )("$name", async ({ testCase }, { run }) => {
      await run(testCase);
    });
  },
);
