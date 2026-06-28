import {
  Agent,
  OpenAIProvider,
  Runner,
  type NonStreamRunOptions,
} from "@openai/agents";
import type OpenAI from "openai";
import { normalizePotentialProofLikeDecision } from "./abv";
import {
  BottleCandidateSchema,
  BottleClassifierAgentDecisionSchema,
  BottleSearchEvidenceSchema,
  EntityResolutionSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleClassificationDecision,
  type BottleClassifierAgentDecision,
  type BottleClassifierAgentDecisionInput,
  type BottleExtractedDetails,
  type BottleSearchEvidence,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "./classifierTypes";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  type BottleClassificationArtifacts,
  type BottleClassificationResult,
  type BottleReference,
  type CandidateExpansionMode,
  type ClassifyBottleReferenceInput,
} from "./contract";
import { BottleClassificationError } from "./error";
import { createWhiskyLabelExtractor } from "./extractor";
import { buildBottleClassifierInstructions } from "./instructions";
import { getStableOpenAISettings } from "./openaiModelSettings";
import {
  finalizeBottleReferenceClassification,
  getAutoIgnoreBottleReferenceReason,
} from "./reviewPolicy";
import {
  buildAgentInput,
  buildDefaultBottleSearchInput,
} from "./runtime/agentInput";
import {
  mergeBottleCandidate,
  mergeResolvedEntity,
} from "./runtime/candidates";
import {
  applyDeterministicIdentitySeed,
  getDeterministicIdentitySeed,
  resolveDeterministicBottleReference,
} from "./runtime/deterministic";
import {
  createBottleWebSearchBudget,
  createBraveWebSearchTool,
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
  runBottleWebEvidenceSearch,
} from "./tools";
import type { BottleWebSearchBudget } from "./tools/sharedWebSearch";

const CLASSIFIER_MAX_TURNS = 8;
const WHISKY_REFERENCE_PATTERN =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisk(?:e)?y)\b/i;

export type BottleClassifierReasoningResult = {
  decision: BottleClassifierAgentDecisionInput;
  artifacts: BottleClassificationArtifacts;
};

type BottleClassifierReasoningRun = {
  reasoning: BottleClassifierReasoningResult;
  webSearchBudget?: BottleWebSearchBudget;
};

export type RunBottleClassifierAgentInput = {
  reference: BottleReference;
  extractedIdentity?: BottleExtractedDetails | null;
  initialCandidates?: BottleCandidate[];
  candidateExpansion?: CandidateExpansionMode;
  searchEvidence?: BottleSearchEvidence[];
  resolvedEntities?: EntityResolution[];
  investigationHint?: string | null;
  webSearchBudget?: BottleWebSearchBudget;
};

export type BottleClassifierDataSource = {
  findInitialCandidates?: (args: {
    reference: BottleReference;
    extractedIdentity: BottleExtractedDetails | null;
  }) => Promise<BottleCandidate[]>;
  searchBottles: (
    args: BottleCandidateSearchInput,
  ) => Promise<BottleCandidate[]>;
  getBottleCandidateById?: (
    bottleId: number,
    releaseId: number | null,
  ) => Promise<BottleCandidate | null>;
  searchEntities?: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
};

export type BottleClassifierAdapters = BottleClassifierDataSource;

type BaseCreateBottleClassifierOptions = {
  client: OpenAI;
  model: string;
  maxSearchQueries: number;
  braveApiKey?: string | null;
  overrides?: {
    extractFromImage?: (
      imageUrlOrBase64: string,
    ) => Promise<BottleExtractedDetails | null>;
    extractFromText?: (label: string) => Promise<BottleExtractedDetails | null>;
    runBottleClassifierAgent?: (
      input: RunBottleClassifierAgentInput,
    ) => Promise<BottleClassifierReasoningResult>;
  };
};

export type CreateBottleClassifierOptions = BaseCreateBottleClassifierOptions &
  (
    | {
        dataSource: BottleClassifierDataSource;
        adapters?: never;
      }
    | {
        adapters: BottleClassifierDataSource;
        dataSource?: never;
      }
  );

export type BottleClassifier = {
  classifyBottleReference: (
    input: ClassifyBottleReferenceInput,
  ) => Promise<BottleClassificationResult>;
  runBottleClassifierAgent: (
    input: RunBottleClassifierAgentInput,
  ) => Promise<BottleClassifierReasoningResult>;
  extractBottleReferenceIdentity: (
    reference: Pick<BottleReference, "name" | "imageUrl">,
  ) => Promise<BottleExtractedDetails | null>;
  extractFromImage: (
    imageUrlOrBase64: string,
  ) => Promise<BottleExtractedDetails | null>;
  extractFromText: (label: string) => Promise<BottleExtractedDetails | null>;
};

function parseAgentDecision(
  decision: BottleClassifierAgentDecisionInput,
): BottleClassifierAgentDecision {
  return BottleClassifierAgentDecisionSchema.parse(
    normalizePotentialProofLikeDecision(decision),
  );
}

function createIgnoredReferenceClassification(
  reason: string,
  artifacts: BottleClassificationArtifacts,
): BottleClassificationResult {
  return createIgnoredBottleClassification({
    reason,
    artifacts,
  });
}

function hydratedCurrentBottleMatchesReference({
  currentBottle,
  bottleId,
  releaseId,
}: {
  currentBottle: BottleCandidate | null;
  bottleId: number;
  releaseId: number | null;
}): boolean {
  if (!currentBottle || currentBottle.bottleId !== bottleId) {
    return false;
  }

  return releaseId !== null
    ? currentBottle.releaseId === releaseId
    : currentBottle.releaseId === null || currentBottle.kind === "bottle";
}

type BottleClassifierAgentRunState = {
  candidateBottles: Map<string, BottleCandidate>;
  resolvedEntities: Map<number, EntityResolution>;
  searchEvidence: BottleClassificationArtifacts["searchEvidence"];
};

function getBottleClassifierDataSource(
  options: CreateBottleClassifierOptions,
): BottleClassifierDataSource {
  const dataSource = options.dataSource ?? options.adapters;
  if (!dataSource) {
    throw new Error("Bottle classifier requires a data source.");
  }
  return dataSource;
}

type BottleClassifierAgent = Agent<
  unknown,
  typeof BottleClassifierAgentDecisionSchema
>;

export type PreparedBottleClassifierAgentRun = {
  agent: BottleClassifierAgent;
  getArtifacts: () => BottleClassificationArtifacts;
  getReasoningResult: (result: unknown) => BottleClassifierReasoningResult;
  input: string;
  runOptions: NonStreamRunOptions<unknown, BottleClassifierAgent>;
  runner: Runner;
  webSearchBudget: BottleWebSearchBudget;
};

function mergeSearchEvidence(
  searchEvidence: BottleClassificationArtifacts["searchEvidence"],
  evidence: BottleClassificationArtifacts["searchEvidence"][number],
) {
  const evidenceKey = JSON.stringify({
    provider: evidence.provider,
    query: evidence.query,
    urls: evidence.results.map((result) => result.url),
  });
  const hasExistingEvidence = searchEvidence.some(
    (candidate) =>
      JSON.stringify({
        provider: candidate.provider,
        query: candidate.query,
        urls: candidate.results.map((result) => result.url),
      }) === evidenceKey,
  );

  if (!hasExistingEvidence) {
    searchEvidence.push(evidence);
  }
}

function sortedBottleCandidates(
  candidateBottles: Map<string, BottleCandidate>,
) {
  return Array.from(candidateBottles.values()).sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  );
}

function sortedResolvedEntities(
  resolvedEntities: Map<number, EntityResolution>,
) {
  return Array.from(resolvedEntities.values()).sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  );
}

function mergeSearchEvidenceList(
  existingSearchEvidence: BottleSearchEvidence[],
  nextSearchEvidence: BottleSearchEvidence[],
): BottleSearchEvidence[] {
  const mergedSearchEvidence = [...existingSearchEvidence];

  for (const evidence of nextSearchEvidence) {
    mergeSearchEvidence(mergedSearchEvidence, evidence);
  }

  return mergedSearchEvidence;
}

function mergeCandidateLists(
  existingCandidates: BottleCandidate[],
  nextCandidates: BottleCandidate[],
): BottleCandidate[] {
  const candidatesByKey = new Map<string, BottleCandidate>();

  for (const candidate of existingCandidates) {
    mergeBottleCandidate(candidatesByKey, candidate);
  }
  for (const candidate of nextCandidates) {
    mergeBottleCandidate(candidatesByKey, candidate);
  }

  return sortedBottleCandidates(candidatesByKey);
}

function buildReasoningArtifacts({
  extractedIdentity,
  state,
}: {
  extractedIdentity: BottleExtractedDetails | null;
  state: BottleClassifierAgentRunState;
}) {
  return buildBottleClassificationArtifacts({
    extractedIdentity,
    searchEvidence: state.searchEvidence,
    candidates: sortedBottleCandidates(state.candidateBottles),
    resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
  });
}

function hasUsableOpenAIResponsesClient(client: OpenAI): boolean {
  return (
    typeof (client as { responses?: { create?: unknown } }).responses
      ?.create === "function"
  );
}

function addSearchPart(
  parts: string[],
  value: string | number | null | undefined,
) {
  const normalizedValue =
    typeof value === "number" ? String(value) : value?.trim();
  if (!normalizedValue) {
    return;
  }

  if (
    !parts.some((part) => part.toLowerCase() === normalizedValue.toLowerCase())
  ) {
    parts.push(normalizedValue);
  }
}

function extractedIdentityLooksWebInvestigable({
  reference,
  extractedIdentity,
}: {
  reference: BottleReference;
  extractedIdentity: BottleExtractedDetails | null;
}): boolean {
  if (!extractedIdentity?.brand) {
    return false;
  }

  return (
    WHISKY_REFERENCE_PATTERN.test(reference.name) ||
    extractedIdentity.category !== null ||
    extractedIdentity.expression !== null ||
    extractedIdentity.series !== null ||
    Boolean(extractedIdentity.distillery?.length) ||
    extractedIdentity.stated_age !== null ||
    extractedIdentity.abv !== null ||
    extractedIdentity.edition !== null ||
    extractedIdentity.cask_type !== null ||
    extractedIdentity.cask_size !== null ||
    extractedIdentity.cask_fill !== null ||
    extractedIdentity.cask_strength === true ||
    extractedIdentity.single_cask === true ||
    extractedIdentity.vintage_year !== null ||
    extractedIdentity.release_year !== null
  );
}

function shouldPreloadWebInvestigation({
  candidateExpansion,
  artifacts,
  options,
  reference,
}: {
  candidateExpansion: CandidateExpansionMode;
  artifacts: BottleClassificationArtifacts;
  options: CreateBottleClassifierOptions;
  reference: BottleReference;
}): boolean {
  return (
    candidateExpansion === "open" &&
    artifacts.searchEvidence.length === 0 &&
    reference.currentBottleId == null &&
    reference.currentReleaseId == null &&
    !artifacts.candidates.some((candidate) =>
      candidate.source.includes("exact"),
    ) &&
    options.maxSearchQueries > 0 &&
    hasUsableOpenAIResponsesClient(options.client) &&
    extractedIdentityLooksWebInvestigable({
      reference,
      extractedIdentity: artifacts.extractedIdentity,
    })
  );
}

function addEntitySearchRequest(
  requests: SearchEntitiesArgs[],
  seen: Set<string>,
  query: string | null | undefined,
  type: SearchEntitiesArgs["type"],
) {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) {
    return;
  }

  const key = `${type ?? "any"}:${normalizedQuery.toLowerCase()}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  requests.push({
    query: normalizedQuery,
    type,
    limit: 5,
  });
}

async function collectInitialResolvedEntities({
  candidateExpansion,
  extractedIdentity,
  options,
}: {
  candidateExpansion: CandidateExpansionMode;
  extractedIdentity: BottleExtractedDetails | null;
  options: CreateBottleClassifierOptions;
}): Promise<EntityResolution[]> {
  const dataSource = getBottleClassifierDataSource(options);
  if (
    candidateExpansion !== "open" ||
    !dataSource.searchEntities ||
    !extractedIdentity
  ) {
    return [];
  }

  const requests: SearchEntitiesArgs[] = [];
  const seen = new Set<string>();
  addEntitySearchRequest(requests, seen, extractedIdentity.brand, "brand");
  addEntitySearchRequest(requests, seen, extractedIdentity.bottler, "bottler");
  for (const distillery of extractedIdentity.distillery ?? []) {
    addEntitySearchRequest(requests, seen, distillery, "distiller");
  }

  const searchEntities = dataSource.searchEntities;
  const resolvedEntities = new Map<number, EntityResolution>();
  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        return await searchEntities(request);
      } catch {
        return [];
      }
    }),
  );

  for (const result of results.flat()) {
    mergeResolvedEntity(resolvedEntities, result);
  }

  return sortedResolvedEntities(resolvedEntities);
}

function countWebSearchEvidenceResults(searchEvidence: BottleSearchEvidence[]) {
  return searchEvidence.reduce(
    (total, evidence) => total + evidence.results.length,
    0,
  );
}

function buildNoMatchInvestigationQuery({
  reference,
  extractedIdentity,
}: {
  reference: BottleReference;
  extractedIdentity: BottleExtractedDetails | null;
}): string | null {
  const parts: string[] = [];

  addSearchPart(parts, extractedIdentity?.brand);
  addSearchPart(parts, extractedIdentity?.series);
  addSearchPart(parts, extractedIdentity?.expression);
  if (extractedIdentity?.stated_age != null) {
    addSearchPart(parts, `${extractedIdentity.stated_age} year old`);
  }
  addSearchPart(parts, extractedIdentity?.category?.replace(/_/g, " "));
  for (const distillery of extractedIdentity?.distillery ?? []) {
    addSearchPart(parts, distillery);
  }
  addSearchPart(parts, extractedIdentity?.bottler);
  addSearchPart(parts, extractedIdentity?.edition);
  addSearchPart(parts, extractedIdentity?.cask_type?.replace(/_/g, " "));
  addSearchPart(parts, extractedIdentity?.cask_size?.replace(/_/g, " "));
  addSearchPart(parts, extractedIdentity?.cask_fill?.replace(/_/g, " "));
  if (extractedIdentity?.cask_strength) {
    addSearchPart(parts, "cask strength");
  }
  if (extractedIdentity?.single_cask) {
    addSearchPart(parts, "single cask");
  }
  if (extractedIdentity?.abv != null) {
    addSearchPart(parts, `${extractedIdentity.abv}% ABV`);
  }
  if (extractedIdentity?.vintage_year != null) {
    addSearchPart(parts, `${extractedIdentity.vintage_year} vintage`);
  }
  if (extractedIdentity?.release_year != null) {
    addSearchPart(parts, `${extractedIdentity.release_year} release`);
  }

  if (!parts.length) {
    addSearchPart(parts, reference.name);
  }

  return parts.length ? parts.join(" ") : null;
}

function shouldRetryNoMatchWithWebInvestigation({
  candidateExpansion,
  decision,
  artifacts,
  options,
  reference,
}: {
  candidateExpansion: CandidateExpansionMode;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
  options: CreateBottleClassifierOptions;
  reference: BottleReference;
}): boolean {
  return (
    candidateExpansion === "open" &&
    decision.action === "no_match" &&
    options.maxSearchQueries > 0 &&
    hasUsableOpenAIResponsesClient(options.client) &&
    extractedIdentityLooksWebInvestigable({
      reference,
      extractedIdentity: artifacts.extractedIdentity,
    })
  );
}

async function collectNoMatchWebInvestigationArtifacts({
  options,
  reference,
  artifacts,
  webSearchBudget,
}: {
  options: CreateBottleClassifierOptions;
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
  webSearchBudget?: BottleWebSearchBudget;
}): Promise<BottleClassificationArtifacts> {
  const query = buildNoMatchInvestigationQuery({
    reference,
    extractedIdentity: artifacts.extractedIdentity,
  });

  if (!query) {
    return artifacts;
  }

  const searchEvidence = [...artifacts.searchEvidence];
  const result = await runBottleWebEvidenceSearch({
    client: options.client,
    model: options.model,
    query,
    budget:
      webSearchBudget ?? createBottleWebSearchBudget(options.maxSearchQueries),
    braveApiKey: options.braveApiKey,
    onEvidence: (evidence) => {
      mergeSearchEvidence(searchEvidence, evidence);
    },
  });

  if ("error" in result || result.results.length === 0) {
    return buildBottleClassificationArtifacts({
      ...artifacts,
      searchEvidence,
    });
  }

  mergeSearchEvidence(searchEvidence, result);

  let candidates = artifacts.candidates;
  const dataSource = getBottleClassifierDataSource(options);
  try {
    candidates = mergeCandidateLists(
      candidates,
      await dataSource.searchBottles({
        ...buildDefaultBottleSearchInput({
          reference,
          extractedIdentity: artifacts.extractedIdentity,
        }),
        query,
      }),
    );
  } catch {
    candidates = artifacts.candidates;
  }

  return buildBottleClassificationArtifacts({
    ...artifacts,
    candidates,
    searchEvidence,
  });
}

export async function finalizeBottleClassifierReasoningResult({
  reference,
  reasoning,
}: {
  reference: BottleReference;
  reasoning: BottleClassifierReasoningResult;
}): Promise<{
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}> {
  const artifacts = reasoning.artifacts;
  const decision = finalizeBottleReferenceClassification({
    reference,
    decision: reasoning.decision,
    artifacts,
  });

  return {
    decision,
    artifacts,
  };
}

function parseJsonIfPossible(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getObjectProperty(value: unknown, propertyName: string) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[propertyName]
    : undefined;
}

function stringProperty(value: unknown, propertyName: string) {
  const property = getObjectProperty(value, propertyName);
  return typeof property === "string" ? property : undefined;
}

function normalizeToolOutputValue(value: unknown): unknown {
  if (typeof value === "string") {
    return parseJsonIfPossible(value);
  }

  if (value && typeof value === "object") {
    const outputType = stringProperty(value, "type");
    const text = stringProperty(value, "text");
    if (outputType === "text" && text !== undefined) {
      return parseJsonIfPossible(text);
    }
  }

  return value;
}

function mergeToolOutputArtifacts({
  state,
  toolName,
  output,
}: {
  state: BottleClassifierAgentRunState;
  toolName: string | undefined;
  output: unknown;
}) {
  const normalizedOutput = normalizeToolOutputValue(output);

  if (toolName === "search_bottles") {
    const results = getObjectProperty(normalizedOutput, "results");
    if (!Array.isArray(results)) {
      return;
    }

    for (const candidate of results) {
      mergeBottleCandidate(
        state.candidateBottles,
        BottleCandidateSchema.parse(candidate),
      );
    }
    return;
  }

  if (toolName === "search_entities") {
    const results = getObjectProperty(normalizedOutput, "results");
    if (!Array.isArray(results)) {
      return;
    }

    for (const result of results) {
      mergeResolvedEntity(
        state.resolvedEntities,
        EntityResolutionSchema.parse(result),
      );
    }
    return;
  }

  if (toolName === "openai_web_search" || toolName === "brave_web_search") {
    const evidence = BottleSearchEvidenceSchema.safeParse(normalizedOutput);
    if (evidence.success) {
      mergeSearchEvidence(state.searchEvidence, evidence.data);
    }
  }
}

function mergeRunResultToolArtifacts(
  state: BottleClassifierAgentRunState,
  result: unknown,
) {
  const newItems = getObjectProperty(result, "newItems");
  if (!Array.isArray(newItems)) {
    return;
  }

  for (const item of newItems) {
    if (stringProperty(item, "type") !== "tool_call_output_item") {
      continue;
    }

    const rawItem = getObjectProperty(item, "rawItem");
    mergeToolOutputArtifacts({
      state,
      toolName: stringProperty(rawItem, "name") ?? stringProperty(item, "name"),
      output:
        getObjectProperty(item, "output") ??
        getObjectProperty(rawItem, "output"),
    });
  }
}

function getAgentFinalOutput(result: unknown) {
  return getObjectProperty(result, "finalOutput");
}

export async function prepareBottleClassifierAgentRun(
  options: CreateBottleClassifierOptions,
  {
    reference,
    extractedIdentity,
    initialCandidates = [],
    candidateExpansion = "open",
    searchEvidence = [],
    resolvedEntities = [],
    investigationHint = null,
    webSearchBudget: inputWebSearchBudget,
  }: RunBottleClassifierAgentInput,
): Promise<PreparedBottleClassifierAgentRun> {
  const dataSource = getBottleClassifierDataSource(options);
  const state: BottleClassifierAgentRunState = {
    searchEvidence: [],
    candidateBottles: new Map<string, BottleCandidate>(),
    resolvedEntities: new Map<number, EntityResolution>(),
  };
  const normalizedExtractedIdentity = extractedIdentity ?? null;
  const hasExactAliasMatch = initialCandidates.some((candidate) =>
    candidate.source.includes("exact"),
  );

  for (const evidence of searchEvidence) {
    mergeSearchEvidence(state.searchEvidence, evidence);
  }
  for (const candidate of initialCandidates) {
    mergeBottleCandidate(state.candidateBottles, candidate);
  }
  for (const entity of resolvedEntities) {
    mergeResolvedEntity(state.resolvedEntities, entity);
  }

  const hydratedCurrentBottle = reference.currentBottleId
    ? dataSource.getBottleCandidateById
      ? await dataSource.getBottleCandidateById(
          reference.currentBottleId,
          reference.currentReleaseId ?? null,
        )
      : (initialCandidates.find(
          (candidate) =>
            candidate.bottleId === reference.currentBottleId &&
            (reference.currentReleaseId != null
              ? candidate.releaseId === reference.currentReleaseId
              : candidate.releaseId === null || candidate.kind === "bottle"),
        ) ?? null)
    : null;
  const currentBottle =
    reference.currentBottleId &&
    hydratedCurrentBottleMatchesReference({
      currentBottle: hydratedCurrentBottle,
      bottleId: reference.currentBottleId,
      releaseId: reference.currentReleaseId ?? null,
    })
      ? hydratedCurrentBottle
      : null;
  if (currentBottle) {
    mergeBottleCandidate(state.candidateBottles, currentBottle);
  }

  const allowCandidateExpansion = candidateExpansion === "open";
  const webSearchBudget =
    inputWebSearchBudget ??
    createBottleWebSearchBudget(options.maxSearchQueries);
  const instructions = buildBottleClassifierInstructions({
    maxSearchQueries: options.maxSearchQueries,
    hasBottleSearch: allowCandidateExpansion,
    hasOpenAIWebSearch: allowCandidateExpansion,
    hasBraveWebSearch: allowCandidateExpansion && !!options.braveApiKey,
    hasEntitySearch: allowCandidateExpansion && !!dataSource.searchEntities,
  });

  const tools = allowCandidateExpansion
    ? [
        createSearchBottlesTool({
          searchBottles: dataSource.searchBottles,
          onResults: (results) => {
            for (const candidate of results) {
              mergeBottleCandidate(state.candidateBottles, candidate);
            }
          },
        }),
        ...(dataSource.searchEntities
          ? [
              createSearchEntitiesTool({
                searchEntities: dataSource.searchEntities,
                onResults: (results) => {
                  for (const result of results) {
                    mergeResolvedEntity(state.resolvedEntities, result);
                  }
                },
              }),
            ]
          : []),
        createOpenAIWebSearchTool({
          client: options.client,
          model: options.model,
          budget: webSearchBudget,
          braveApiKey: options.braveApiKey,
          onEvidence: (evidence) => {
            mergeSearchEvidence(state.searchEvidence, evidence);
          },
        }),
        ...(options.braveApiKey
          ? [
              createBraveWebSearchTool({
                apiKey: options.braveApiKey,
                budget: webSearchBudget,
                onEvidence: (evidence) => {
                  mergeSearchEvidence(state.searchEvidence, evidence);
                },
              }),
            ]
          : []),
      ]
    : [];

  const agent: BottleClassifierAgent = new Agent({
    name: "bottle_classifier_reasoner",
    instructions,
    model: options.model,
    modelSettings: {
      parallelToolCalls: false,
      ...getStableOpenAISettings(options.model),
    },
    outputType: BottleClassifierAgentDecisionSchema,
    tools,
  });
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient: options.client,
      useResponses: true,
    }),
    workflowName: "Bottle Classifier",
    groupId:
      reference.id === undefined || reference.id === null
        ? undefined
        : `bottle_reference:${reference.id}`,
    traceMetadata: {
      source_id:
        reference.id === undefined || reference.id === null
          ? "none"
          : `${reference.id}`,
      external_site_id:
        reference.externalSiteId === undefined ||
        reference.externalSiteId === null
          ? "none"
          : `${reference.externalSiteId}`,
      current_bottle_id: reference.currentBottleId
        ? `${reference.currentBottleId}`
        : "none",
    },
  });
  const input = buildAgentInput({
    reference,
    extractedIdentity: normalizedExtractedIdentity,
    initialCandidates,
    currentBottle,
    hasExactAliasMatch,
    candidateExpansion,
    searchEvidence: state.searchEvidence,
    resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
    investigationHint,
  });
  const getArtifacts = () =>
    buildReasoningArtifacts({
      extractedIdentity: normalizedExtractedIdentity,
      state,
    });

  return {
    agent,
    runner,
    input,
    runOptions: {
      maxTurns: CLASSIFIER_MAX_TURNS,
      stream: false,
    },
    webSearchBudget,
    getArtifacts,
    getReasoningResult: (result) => {
      mergeRunResultToolArtifacts(state, result);

      const finalOutput = getAgentFinalOutput(result);
      if (!finalOutput) {
        throw new Error("Agent returned empty output");
      }

      return {
        decision: parseAgentDecision(
          finalOutput as BottleClassifierAgentDecisionInput,
        ),
        artifacts: getArtifacts(),
      };
    },
  };
}

export function createBottleClassifier(
  options: CreateBottleClassifierOptions,
): BottleClassifier {
  const extractor = createWhiskyLabelExtractor({
    client: options.client,
    model: options.model,
  });

  const extractFromImage = async (imageUrlOrBase64: string) =>
    options.overrides?.extractFromImage
      ? await options.overrides.extractFromImage(imageUrlOrBase64)
      : await extractor.extractFromImage(imageUrlOrBase64);

  const extractFromText = async (label: string) =>
    options.overrides?.extractFromText
      ? await options.overrides.extractFromText(label)
      : await extractor.extractFromText(label);

  const extractBottleReferenceIdentity = async (
    reference: Pick<BottleReference, "name" | "imageUrl">,
  ): Promise<BottleExtractedDetails | null> => {
    let imageExtractionError: unknown = null;

    if (reference.imageUrl) {
      try {
        const extractedFromImage = await extractFromImage(reference.imageUrl);
        if (extractedFromImage) {
          return extractedFromImage;
        }
      } catch (error) {
        imageExtractionError = error;
      }
    }

    try {
      return await extractFromText(reference.name);
    } catch (error) {
      if (imageExtractionError) {
        throw imageExtractionError;
      }
      throw error;
    }
  };

  const resolveInitialCandidates = async ({
    reference,
    extractedIdentity,
    initialCandidates,
  }: Pick<ClassifyBottleReferenceInput, "reference" | "initialCandidates"> & {
    extractedIdentity: BottleExtractedDetails | null;
  }): Promise<BottleCandidate[]> => {
    const dataSource = getBottleClassifierDataSource(options);
    if (initialCandidates !== undefined) {
      return initialCandidates;
    }

    if (dataSource.findInitialCandidates) {
      return await dataSource.findInitialCandidates({
        reference,
        extractedIdentity,
      });
    }

    return await dataSource.searchBottles(
      buildDefaultBottleSearchInput({
        reference,
        extractedIdentity,
      }),
    );
  };

  const runPreparedBottleClassifierAgent = async (
    preparedRun: PreparedBottleClassifierAgentRun,
  ): Promise<BottleClassifierReasoningResult> => {
    try {
      const result = await preparedRun.runner.run(
        preparedRun.agent,
        preparedRun.input,
        preparedRun.runOptions,
      );

      return preparedRun.getReasoningResult(result);
    } catch (error) {
      throw new BottleClassificationError(
        error instanceof Error ? error.message : "Unknown classifier error",
        preparedRun.getArtifacts(),
        {
          cause: error,
        },
      );
    }
  };

  const runBottleClassifierAgentWithBudget = async ({
    reference,
    extractedIdentity,
    initialCandidates = [],
    candidateExpansion = "open",
    searchEvidence = [],
    resolvedEntities = [],
    investigationHint = null,
    webSearchBudget,
  }: RunBottleClassifierAgentInput): Promise<BottleClassifierReasoningRun> => {
    if (options.overrides?.runBottleClassifierAgent) {
      const reasoning = await options.overrides.runBottleClassifierAgent({
        reference,
        extractedIdentity,
        initialCandidates,
        candidateExpansion,
        searchEvidence,
        resolvedEntities,
        investigationHint,
        webSearchBudget,
      });

      return {
        reasoning: {
          ...reasoning,
          artifacts: buildBottleClassificationArtifacts({
            ...reasoning.artifacts,
            searchEvidence: mergeSearchEvidenceList(
              searchEvidence,
              reasoning.artifacts.searchEvidence,
            ),
            resolvedEntities: [
              ...resolvedEntities,
              ...reasoning.artifacts.resolvedEntities,
            ],
          }),
        },
        webSearchBudget,
      };
    }

    const preparedRun = await prepareBottleClassifierAgentRun(options, {
      reference,
      initialCandidates,
      extractedIdentity,
      candidateExpansion,
      searchEvidence,
      resolvedEntities,
      investigationHint,
      webSearchBudget,
    });

    return {
      reasoning: await runPreparedBottleClassifierAgent(preparedRun),
      webSearchBudget: preparedRun.webSearchBudget,
    };
  };

  const runBottleClassifierAgent = async (
    input: RunBottleClassifierAgentInput,
  ): Promise<BottleClassifierReasoningResult> => {
    const { reasoning } = await runBottleClassifierAgentWithBudget(input);
    return reasoning;
  };

  const classifyBottleReference = async (
    input: ClassifyBottleReferenceInput,
  ): Promise<BottleClassificationResult> => {
    const parsedInput = ClassifyBottleReferenceInputSchema.parse(input);
    let artifacts = buildBottleClassificationArtifacts({});

    try {
      const deterministicIdentitySeed = getDeterministicIdentitySeed(
        parsedInput.reference,
      );
      const rawExtractedIdentity =
        parsedInput.extractedIdentity !== undefined
          ? parsedInput.extractedIdentity
          : (deterministicIdentitySeed ??
            (await extractBottleReferenceIdentity(parsedInput.reference)));
      const extractedIdentity = applyDeterministicIdentitySeed({
        reference: parsedInput.reference,
        extractedIdentity: rawExtractedIdentity,
      });

      artifacts = buildBottleClassificationArtifacts({
        extractedIdentity,
      });

      const autoIgnoreReason = getAutoIgnoreBottleReferenceReason(
        parsedInput.reference.name,
        artifacts.extractedIdentity,
      );
      if (autoIgnoreReason) {
        return BottleClassificationResultSchema.parse(
          createIgnoredReferenceClassification(autoIgnoreReason, artifacts),
        );
      }

      const candidates = await resolveInitialCandidates({
        reference: parsedInput.reference,
        extractedIdentity,
        initialCandidates: parsedInput.initialCandidates,
      });

      artifacts = buildBottleClassificationArtifacts({
        extractedIdentity,
        candidates,
      });

      const deterministicDecision = resolveDeterministicBottleReference({
        reference: parsedInput.reference,
        artifacts,
      });
      if (deterministicDecision) {
        return BottleClassificationResultSchema.parse(
          createDecidedBottleClassification({
            decision: deterministicDecision,
            artifacts,
          }),
        );
      }

      const resolvedEntities = await collectInitialResolvedEntities({
        candidateExpansion: parsedInput.candidateExpansion,
        extractedIdentity,
        options,
      });
      artifacts = buildBottleClassificationArtifacts({
        ...artifacts,
        resolvedEntities,
      });

      const webSearchBudget = createBottleWebSearchBudget(
        options.maxSearchQueries,
      );
      if (
        shouldPreloadWebInvestigation({
          candidateExpansion: parsedInput.candidateExpansion,
          artifacts,
          options,
          reference: parsedInput.reference,
        })
      ) {
        artifacts = await collectNoMatchWebInvestigationArtifacts({
          options,
          reference: parsedInput.reference,
          artifacts,
          webSearchBudget,
        });
      }

      const reasoningRun = await runBottleClassifierAgentWithBudget({
        reference: parsedInput.reference,
        extractedIdentity: artifacts.extractedIdentity,
        initialCandidates: artifacts.candidates,
        candidateExpansion: parsedInput.candidateExpansion,
        searchEvidence: artifacts.searchEvidence,
        resolvedEntities: artifacts.resolvedEntities,
        investigationHint:
          artifacts.searchEvidence.length > 0
            ? "Initial local candidates were not exact aliases, so web evidence was gathered before the first reasoning pass. Judge source quality from the evidence content, discard weak or irrelevant results, and use local search tools if the evidence suggests a better database candidate."
            : null,
        webSearchBudget,
      });
      let { decision, artifacts: reasoningArtifacts } =
        await finalizeBottleClassifierReasoningResult({
          reference: parsedInput.reference,
          reasoning: reasoningRun.reasoning,
        });

      if (
        shouldRetryNoMatchWithWebInvestigation({
          candidateExpansion: parsedInput.candidateExpansion,
          decision,
          artifacts: reasoningArtifacts,
          options,
          reference: parsedInput.reference,
        })
      ) {
        const previousSearchEvidenceResultCount = countWebSearchEvidenceResults(
          reasoningArtifacts.searchEvidence,
        );
        const investigationArtifacts =
          await collectNoMatchWebInvestigationArtifacts({
            options,
            reference: parsedInput.reference,
            artifacts: reasoningArtifacts,
            webSearchBudget: reasoningRun.webSearchBudget,
          });

        if (
          countWebSearchEvidenceResults(investigationArtifacts.searchEvidence) >
          previousSearchEvidenceResultCount
        ) {
          const retryReasoningRun = await runBottleClassifierAgentWithBudget({
            reference: parsedInput.reference,
            extractedIdentity: investigationArtifacts.extractedIdentity,
            initialCandidates: investigationArtifacts.candidates,
            candidateExpansion: parsedInput.candidateExpansion,
            searchEvidence: investigationArtifacts.searchEvidence,
            resolvedEntities: investigationArtifacts.resolvedEntities,
            investigationHint:
              "The first pass found no safe local match. Web evidence was gathered because the reference appears to be a real whisky bottle. Use the provided web evidence and local search tools to fully classify the bottle as an existing match, a supported create action, or a justified no_match.",
            webSearchBudget: reasoningRun.webSearchBudget,
          });

          const retriedResult = await finalizeBottleClassifierReasoningResult({
            reference: parsedInput.reference,
            reasoning: retryReasoningRun.reasoning,
          });
          decision = retriedResult.decision;
          reasoningArtifacts = retriedResult.artifacts;
        }
      }

      return BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision,
          artifacts: reasoningArtifacts,
        }),
      );
    } catch (error) {
      if (error instanceof BottleClassificationError) {
        throw error;
      }

      throw new BottleClassificationError(
        error instanceof Error ? error.message : "Unknown classifier error",
        artifacts,
        {
          cause: error,
        },
      );
    }
  };

  return {
    classifyBottleReference,
    runBottleClassifierAgent,
    extractBottleReferenceIdentity,
    extractFromImage,
    extractFromText,
  };
}
