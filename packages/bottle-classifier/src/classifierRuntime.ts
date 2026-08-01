import {
  Agent,
  OpenAIProvider,
  Runner,
  type JsonSchemaDefinition,
  type NonStreamRunOptions,
} from "@openai/agents";
import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { z } from "zod";
import { normalizePotentialProofLikeDecision } from "./abv";
import type { BottleContext, EntityContext } from "./bottleContextContract";
import {
  BottleClassifierAgentDecisionSchema,
  type BottleCandidate,
  type BottleClassificationDecision,
  type BottleClassifierAgentDecision,
  type BottleClassifierAgentDecisionInput,
  type BottleExtractedDetails,
  type BottleSearchEvidence,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "./classifierTypes";
import {
  AuditBottleInputSchema,
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  FindingSchema,
  ProposedOperationsSchema,
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  getBottleCheckSourceEvidencePaths,
  type AuditBottleInput,
  type AuditBottleResult,
  type BottleClassificationArtifacts,
  type BottleClassificationResult,
  type BottleReference,
  type CandidateExpansionMode,
  type ClassifyBottleReferenceInput,
  type Finding,
  type ProposedOperation,
} from "./contract";
import { BottleClassificationError } from "./error";
import { createWhiskyLabelExtractor } from "./extractor";
import type { ImageBottleEvidence } from "./imageEvidence";
import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
  buildBottleLocalIdentifierInstructions,
} from "./instructions";
import { startAgentSpan, type AgentSpanAttributes } from "./observability";
import { getStableOpenAISettings } from "./openaiModelSettings";
import {
  finalizeBottleReferenceClassification,
  getAutoIgnoreBottleReferenceReason,
} from "./reviewPolicy";
import {
  buildAgentInput,
  buildAuditBottleAgentInput,
  buildDefaultBottleSearchInput,
} from "./runtime/agentInput";
import {
  bottleContextToCandidate,
  createBottleContextLoader,
} from "./runtime/bottleCheckContext";
import {
  assertFindingsUseCollectedEvidence,
  buildAgentArtifacts,
  createBottleCheckTools,
  createRunProposalCollector,
  getAgentFinalOutput,
  mergeRunResultToolArtifacts,
  mergeSearchEvidence,
  observeRunnerTools,
  sortedBottleCandidates,
  sortedResolvedEntities,
  type BottleClassifierAgentRunState,
  type BottleClassifierDataSource,
  type BottleClassifierToolEvent,
} from "./runtime/bottleCheckRuntime";
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
  getBottleClassifierRunMetadata,
  type BottleClassifierRunMetadata,
} from "./runtime/runMetadata";
import type { BottleWebSearchExecutor } from "./tools";
import {
  createBottleWebSearchBudget,
  executeBottleWebSearchInvocation,
  runBottleWebEvidenceSearch,
  runFirecrawlWebSearch,
} from "./tools";
import type { BottleWebSearchBudget } from "./tools/sharedWebSearch";
export { createBottleContextLoader } from "./runtime/bottleCheckContext";
export type {
  BottleClassifierDataSource,
  BottleClassifierToolEvent,
} from "./runtime/bottleCheckRuntime";

const CLASSIFIER_MAX_TURNS = 8;
const MAX_CANDIDATE_ENTITY_SEARCH_REQUESTS = 12;
const WHISKY_REFERENCE_PATTERN =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisk(?:e)?y)\b/i;

export type BottleClassifierAgentResult = {
  decision: BottleClassifierAgentDecisionInput;
  proposedOperations?: ProposedOperation[];
  findings?: Finding[];
  artifacts: BottleClassificationArtifacts;
};

const BottleReferenceAgentOutputSchema =
  BottleClassifierAgentDecisionSchema.extend({
    findings: z.array(FindingSchema).default([]),
  });

const BottleLocalIdentifierOutputSchema = BottleClassifierAgentDecisionSchema;

const BottleAuditAgentOutputSchema = z
  .object({
    summary: z.string().trim().min(1),
    findings: z.array(FindingSchema).default([]),
  })
  .strict();

function stripProviderUnsupportedFormats(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripProviderUnsupportedFormats);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      key === "format" ? [] : [[key, stripProviderUnsupportedFormats(child)]],
    ),
  );
}

function createAgentOutputType(
  name: string,
  schema: z.ZodObject,
  strict = false,
): JsonSchemaDefinition {
  return {
    type: "json_schema",
    name,
    strict,
    schema: stripProviderUnsupportedFormats(
      z.toJSONSchema(schema, {
        target: "draft-7",
      }),
    ) as JsonSchemaDefinition["schema"],
  };
}

const BottleReferenceAgentOutputType = createAgentOutputType(
  "bottle_reference_output",
  BottleReferenceAgentOutputSchema,
  true,
);

const BottleLocalIdentifierOutputType = createAgentOutputType(
  "bottle_local_identifier_output",
  BottleLocalIdentifierOutputSchema,
  true,
);

const BottleAuditAgentOutputType = createAgentOutputType(
  "bottle_audit_output",
  BottleAuditAgentOutputSchema,
  true,
);

export type BottleAuditAgentOutput = z.infer<
  typeof BottleAuditAgentOutputSchema
> & {
  proposedOperations: ProposedOperation[];
};

export type RunBottleAuditAgentInput = {
  audit: AuditBottleInput;
  currentBottleContext: BottleContext;
  conversationId: string;
  searchEvidence?: BottleSearchEvidence[];
};

type BottleClassifierAgentRun = {
  modelMetadata: BottleClassifierRunMetadata | null;
  agentResult: BottleClassifierAgentResult;
  webSearchBudget?: BottleWebSearchBudget;
};

export type RunBottleClassifierAgentInput = {
  reference: BottleReference;
  conversationId?: string;
  extractedIdentity?: BottleExtractedDetails | null;
  imageEvidence?: ImageBottleEvidence | null;
  initialCandidates?: BottleCandidate[];
  candidateExpansion?: CandidateExpansionMode;
  searchEvidence?: BottleSearchEvidence[];
  resolvedEntities?: EntityResolution[];
  investigationHint?: string | null;
  identityAnchor?: BottleClassificationDecision | null;
  webSearchBudget?: BottleWebSearchBudget;
  instructionMode?: "classification" | "local_identification";
};

export type BottleClassifierAdapters = BottleClassifierDataSource;

type BaseCreateBottleClassifierOptions = {
  client: OpenAI;
  model: string;
  maxSearchQueries: number;
  firecrawlApiKey?: string | null;
  firecrawlApiUrl?: string | null;
  executeWebSearch?: BottleWebSearchExecutor;
  observeToolEvent?: (event: BottleClassifierToolEvent) => void;
  overrides?: {
    extractFromImage?: (
      imageUrlOrBase64: string,
    ) => Promise<BottleExtractedDetails | null>;
    extractFromText?: (label: string) => Promise<BottleExtractedDetails | null>;
    runBottleClassifierAgent?: (
      input: RunBottleClassifierAgentInput,
    ) => Promise<BottleClassifierAgentResult>;
    runBottleAuditAgent?: (
      input: RunBottleAuditAgentInput,
    ) => Promise<BottleAuditAgentOutput>;
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
  runBottleReference: (
    input: ClassifyBottleReferenceInput,
  ) => Promise<BottleReferenceRun>;
  classifyBottleReference: (
    input: ClassifyBottleReferenceInput,
  ) => Promise<BottleClassificationResult>;
  identifyExistingBottleReference: (
    input: ClassifyBottleReferenceInput,
  ) => Promise<BottleClassificationResult>;
  auditBottle: (input: AuditBottleInput) => Promise<AuditBottleResult>;
  runBottleAudit: (input: AuditBottleInput) => Promise<BottleAuditRun>;
  runBottleClassifierAgent: (
    input: RunBottleClassifierAgentInput,
  ) => Promise<BottleClassifierAgentResult>;
  extractBottleReferenceIdentity: (
    reference: Pick<BottleReference, "name" | "imageUrl">,
  ) => Promise<BottleExtractedDetails | null>;
  extractFromImage: (
    imageUrlOrBase64: string,
  ) => Promise<BottleExtractedDetails | null>;
  extractFromText: (label: string) => Promise<BottleExtractedDetails | null>;
};

export type BottleAuditRun = {
  result: AuditBottleResult;
  modelMetadata: BottleClassifierRunMetadata | null;
};

export type BottleReferenceRun = {
  result: BottleClassificationResult;
  modelMetadata: BottleClassifierRunMetadata | null;
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

function createLocalIdentificationNoMatch({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  if (decision.action === "no_match") {
    return decision;
  }

  return {
    action: "no_match",
    rationale: [
      decision.rationale,
      `Local identification cannot return ${decision.action}; falling back to no_match for the match-only contract.`,
    ]
      .filter(Boolean)
      .join(" "),
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: decision.identityScope,
    observation: decision.observation,
    identityBasis: decision.identityBasis,
    confidenceBasis: {
      positiveEvidence: [],
      unresolvedRisks: [
        {
          category: "other",
          note: "The local-identification contract only allows existing matches.",
        },
      ],
      toolsUsed: artifacts.candidates.length
        ? ["initial_local_candidates"]
        : [],
      webEvidence: "not_used",
    },
    matchedBottleId: null,
    proposedBottle: null,
  };
}

function normalizeLocalIdentificationMatch(
  decision: BottleClassificationDecision,
): BottleClassificationDecision {
  if (decision.action !== "match") {
    return decision;
  }

  return {
    ...decision,
    confidenceBasis: {
      positiveEvidence: decision.confidenceBasis?.positiveEvidence ?? [],
      unresolvedRisks: decision.confidenceBasis?.unresolvedRisks ?? [],
      toolsUsed: (decision.confidenceBasis?.toolsUsed ?? []).filter(
        (tool) =>
          tool === "initial_local_candidates" ||
          tool === "search_bottles" ||
          tool === "search_entities" ||
          tool === "none",
      ),
      webEvidence:
        decision.confidenceBasis?.webEvidence === "not_needed"
          ? "not_needed"
          : "not_used",
    },
  };
}

function hydratedCurrentBottleMatchesReference({
  currentBottle,
  bottleId,
}: {
  currentBottle: BottleCandidate | null;
  bottleId: number;
}): boolean {
  return currentBottle?.bottleId === bottleId;
}

function getBottleClassifierDataSource(
  options: CreateBottleClassifierOptions,
): BottleClassifierDataSource {
  const dataSource = options.dataSource ?? options.adapters;
  if (!dataSource) {
    throw new Error("Bottle classifier requires a data source.");
  }
  return dataSource;
}

type BottleClassifierAgent = Agent<unknown, JsonSchemaDefinition>;

type BottleAuditAgent = Agent<unknown, typeof BottleAuditAgentOutputType>;

export type PreparedBottleClassifierAgentRun = {
  agent: BottleClassifierAgent;
  getArtifacts: () => BottleClassificationArtifacts;
  getAgentResult: (result: unknown) => BottleClassifierAgentResult;
  input: string;
  conversationId: string;
  instructionMode: NonNullable<
    RunBottleClassifierAgentInput["instructionMode"]
  >;
  spanAttributes: AgentSpanAttributes;
  runOptions: NonStreamRunOptions<unknown, BottleClassifierAgent>;
  runner: Runner;
  webSearchBudget: BottleWebSearchBudget;
};

function buildClassifierConversationId(
  reference: BottleReference,
  instructionMode: RunBottleClassifierAgentInput["instructionMode"],
  conversationId?: string,
) {
  const explicitConversationId = conversationId?.trim();
  if (explicitConversationId) {
    return explicitConversationId;
  }

  const prefix =
    instructionMode === "local_identification"
      ? "bottle_identifier"
      : "bottle_reference";
  const id =
    reference.id === undefined || reference.id === null || reference.id === ""
      ? randomUUID()
      : reference.id;

  return `${prefix}:${id}`;
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
  const candidatesByKey = new Map<number, BottleCandidate>();

  for (const candidate of existingCandidates) {
    mergeBottleCandidate(candidatesByKey, candidate);
  }
  for (const candidate of nextCandidates) {
    mergeBottleCandidate(candidatesByKey, candidate);
  }

  return sortedBottleCandidates(candidatesByKey);
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

function referenceHasVariantSearchWording(referenceName: string): boolean {
  return /\b(?:finish(?:ed)?|barrel[-\s]+finished|double[-\s]+oaked|oak|sherry|port|wine|rum|cognac|mizunara|bodega|distillers?\s+edition)\b/i.test(
    referenceName,
  );
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
    extractedIdentity.cask_strength === true ||
    extractedIdentity.single_cask === true ||
    extractedIdentity.cask_type !== null ||
    extractedIdentity.cask_size !== null ||
    extractedIdentity.cask_fill !== null ||
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
  maxRequests = Number.POSITIVE_INFINITY,
) {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) {
    return;
  }

  const key = `${type ?? "any"}:${normalizedQuery.toLowerCase()}`;
  if (seen.has(key) || requests.length >= maxRequests) {
    return;
  }

  seen.add(key);
  requests.push({
    query: normalizedQuery,
    type,
    limit: 5,
  });
}

export async function collectInitialResolvedEntities({
  candidateExpansion,
  extractedIdentity,
  initialCandidates = [],
  options,
}: {
  candidateExpansion: CandidateExpansionMode;
  extractedIdentity: BottleExtractedDetails | null;
  initialCandidates?: BottleCandidate[];
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
  const maxRequests = requests.length + MAX_CANDIDATE_ENTITY_SEARCH_REQUESTS;
  for (const candidate of initialCandidates) {
    addEntitySearchRequest(
      requests,
      seen,
      candidate.brand,
      "brand",
      maxRequests,
    );
    addEntitySearchRequest(
      requests,
      seen,
      candidate.bottler,
      "bottler",
      maxRequests,
    );
    for (const distillery of candidate.distillery) {
      addEntitySearchRequest(
        requests,
        seen,
        distillery,
        "distiller",
        maxRequests,
      );
    }
  }

  const searchEntities = dataSource.searchEntities;
  const resolvedEntities = new Map<number, EntityResolution>();
  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        return {
          request,
          entities: await searchEntities(request),
        };
      } catch {
        return { request, entities: [] };
      }
    }),
  );

  for (const { request, entities } of results) {
    for (const entity of entities) {
      mergeResolvedEntity(resolvedEntities, {
        ...entity,
        retrievedFor: [
          {
            query: request.query,
            requestedType: request.type ?? null,
          },
        ],
      });
    }
  }

  return sortedResolvedEntities(resolvedEntities);
}

function hasContainedSourceEntityCandidate({
  extractedIdentity,
  resolvedEntities,
}: {
  extractedIdentity: BottleExtractedDetails | null;
  resolvedEntities: EntityResolution[];
}) {
  if (!extractedIdentity) {
    return false;
  }

  const sourceQueries = new Set<string>();
  if (extractedIdentity.brand) {
    sourceQueries.add(`brand:${extractedIdentity.brand.toLowerCase()}`);
  }
  if (extractedIdentity.bottler) {
    sourceQueries.add(`bottler:${extractedIdentity.bottler.toLowerCase()}`);
  }
  for (const distillery of extractedIdentity.distillery ?? []) {
    sourceQueries.add(`distiller:${distillery.toLowerCase()}`);
  }

  return resolvedEntities.some(
    (entity) =>
      entity.source.includes("contained") &&
      entity.retrievedFor?.some(({ query, requestedType }) =>
        sourceQueries.has(`${requestedType}:${query.toLowerCase()}`),
      ),
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
  if (extractedIdentity?.cask_strength) {
    addSearchPart(parts, "cask strength");
  }
  if (extractedIdentity?.single_cask) {
    addSearchPart(parts, "single cask");
  }
  addSearchPart(parts, extractedIdentity?.cask_type?.replace(/_/g, " "));
  addSearchPart(parts, extractedIdentity?.cask_size?.replace(/_/g, " "));
  addSearchPart(parts, extractedIdentity?.cask_fill?.replace(/_/g, " "));
  if (extractedIdentity?.abv != null) {
    addSearchPart(parts, `${extractedIdentity.abv}% ABV`);
  }
  if (extractedIdentity?.vintage_year != null) {
    addSearchPart(parts, `${extractedIdentity.vintage_year} vintage`);
  }
  if (extractedIdentity?.release_year != null) {
    addSearchPart(parts, `${extractedIdentity.release_year} release`);
  }

  if (referenceHasVariantSearchWording(reference.name)) {
    addSearchPart(parts, reference.name);
  }

  if (!parts.length) {
    addSearchPart(parts, reference.name);
  }

  return parts.length ? parts.join(" ") : null;
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
  const budget =
    webSearchBudget ?? createBottleWebSearchBudget(options.maxSearchQueries);
  const firecrawlApiKey = options.firecrawlApiKey;
  const toolName = firecrawlApiKey
    ? "firecrawl_web_search"
    : "openai_web_search";
  const toolCallId = `preload_web_search:${randomUUID()}`;
  options.observeToolEvent?.({
    type: "tool_call",
    phase: "preload",
    id: toolCallId,
    name: toolName,
    arguments: { query },
  });
  const result = firecrawlApiKey
    ? await executeBottleWebSearchInvocation({
        budget,
        toolName,
        args: { query },
        execute: async () =>
          await runFirecrawlWebSearch({
            apiKey: firecrawlApiKey,
            apiUrl: options.firecrawlApiUrl ?? undefined,
            query,
          }),
        executeWebSearch: options.executeWebSearch,
      })
    : await runBottleWebEvidenceSearch({
        client: options.client,
        model: options.model,
        query,
        budget,
        executeWebSearch: options.executeWebSearch,
      });
  options.observeToolEvent?.({
    type: "tool_result",
    phase: "preload",
    toolCallId,
    name: toolName,
    result,
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

export async function finalizeBottleClassifierAgentResult({
  reference,
  agentResult,
}: {
  reference: BottleReference;
  agentResult: {
    decision: BottleClassifierAgentDecisionInput;
    artifacts: BottleClassificationArtifacts;
  };
}): Promise<{
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}> {
  const artifacts = agentResult.artifacts;
  const decision = finalizeBottleReferenceClassification({
    reference,
    decision: agentResult.decision,
    artifacts,
  });

  return {
    decision,
    artifacts,
  };
}

export async function prepareBottleClassifierAgentRun(
  options: CreateBottleClassifierOptions,
  {
    reference,
    extractedIdentity,
    imageEvidence,
    initialCandidates = [],
    candidateExpansion = "open",
    searchEvidence = [],
    resolvedEntities = [],
    investigationHint = null,
    identityAnchor = null,
    webSearchBudget: inputWebSearchBudget,
    instructionMode = "classification",
    conversationId,
  }: RunBottleClassifierAgentInput,
): Promise<PreparedBottleClassifierAgentRun> {
  const dataSource = getBottleClassifierDataSource(options);
  const state: BottleClassifierAgentRunState = {
    searchEvidence: [],
    candidateBottles: new Map<number, BottleCandidate>(),
    resolvedEntities: new Map<number, EntityResolution>(),
    bottleContexts: new Map<number, BottleContext>(),
    entityContexts: new Map<number, EntityContext>(),
  };
  const normalizedExtractedIdentity = extractedIdentity ?? null;
  const normalizedImageEvidence = imageEvidence ?? null;
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
      ? await dataSource.getBottleCandidateById(reference.currentBottleId)
      : (initialCandidates.find(
          (candidate) => candidate.bottleId === reference.currentBottleId,
        ) ?? null)
    : null;
  const currentBottle =
    reference.currentBottleId &&
    hydratedCurrentBottleMatchesReference({
      currentBottle: hydratedCurrentBottle,
      bottleId: reference.currentBottleId,
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
  const instructions =
    instructionMode === "local_identification"
      ? buildBottleLocalIdentifierInstructions()
      : buildBottleClassifierInstructions();

  const proposalCollector =
    instructionMode === "classification"
      ? createRunProposalCollector({
          sourceFields: getBottleCheckSourceEvidencePaths({
            intent: "resolve_reference",
            input: { reference },
            artifacts: buildBottleClassificationArtifacts({
              extractedIdentity: normalizedExtractedIdentity,
              imageEvidence: normalizedImageEvidence,
            }),
          }),
          state,
        })
      : null;

  const tools = createBottleCheckTools({
    allowCandidateExpansion,
    dataSource,
    options,
    proposalCollector,
    state,
    webSearchBudget,
  });

  const outputType =
    instructionMode === "local_identification"
      ? BottleLocalIdentifierOutputType
      : BottleReferenceAgentOutputType;
  const agent: BottleClassifierAgent = new Agent({
    name: "bottle_classifier_reasoner",
    instructions,
    model: options.model,
    modelSettings: {
      parallelToolCalls: false,
      ...getStableOpenAISettings(options.model),
    },
    outputType,
    tools,
  });
  const resolvedConversationId = buildClassifierConversationId(
    reference,
    instructionMode,
    conversationId,
  );
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient: options.client,
      useResponses: true,
    }),
    workflowName: "Bottle Classifier",
    groupId: resolvedConversationId,
    traceMetadata: {
      "gen_ai.conversation.id": resolvedConversationId,
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
  observeRunnerTools(runner, options.observeToolEvent);
  const input = buildAgentInput({
    reference,
    extractedIdentity: normalizedExtractedIdentity,
    imageEvidence: normalizedImageEvidence,
    initialCandidates,
    currentBottle,
    hasExactAliasMatch,
    candidateExpansion,
    searchEvidence: state.searchEvidence,
    resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
    investigationHint,
    identityAnchor,
  });
  const getArtifacts = () =>
    buildAgentArtifacts({
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence: normalizedImageEvidence,
      state,
    });

  return {
    agent,
    runner,
    input,
    conversationId: resolvedConversationId,
    instructionMode,
    spanAttributes: {
      "gen_ai.request.model": options.model,
      "bottle_classifier.instruction_mode": instructionMode,
      "bottle_classifier.reference_id":
        reference.id === undefined || reference.id === null
          ? "none"
          : `${reference.id}`,
      "bottle_classifier.current_bottle_id":
        reference.currentBottleId == null
          ? "none"
          : `${reference.currentBottleId}`,
    },
    runOptions: {
      maxTurns: CLASSIFIER_MAX_TURNS,
      stream: false,
    },
    webSearchBudget,
    getArtifacts,
    getAgentResult: (result) => {
      mergeRunResultToolArtifacts(state, result);

      const finalOutput = getAgentFinalOutput(result);
      if (!finalOutput) {
        throw new Error("Agent returned empty output");
      }
      const parsed =
        instructionMode === "local_identification"
          ? {
              ...BottleLocalIdentifierOutputSchema.parse(finalOutput),
              findings: [],
            }
          : BottleReferenceAgentOutputSchema.parse(finalOutput);
      const { findings, ...decision } = parsed;
      if (proposalCollector) {
        assertFindingsUseCollectedEvidence(findings, proposalCollector);
      }
      return {
        decision: parseAgentDecision(decision),
        proposedOperations: proposalCollector?.getProposals() ?? [],
        findings,
        artifacts: getArtifacts(),
      };
    },
  };
}

export type PreparedBottleAuditAgentRun = {
  agent: BottleAuditAgent;
  conversationId: string;
  getArtifacts: () => BottleClassificationArtifacts;
  getOutput: (result: unknown) => BottleAuditAgentOutput;
  input: string;
  runOptions: NonStreamRunOptions<unknown, BottleAuditAgent>;
  runner: Runner;
};

export function prepareBottleAuditAgentRun(
  options: CreateBottleClassifierOptions,
  {
    audit,
    currentBottleContext,
    conversationId,
    searchEvidence = [],
  }: RunBottleAuditAgentInput,
): PreparedBottleAuditAgentRun {
  const dataSource = getBottleClassifierDataSource(options);
  const currentBottle = bottleContextToCandidate(currentBottleContext);
  const state: BottleClassifierAgentRunState = {
    searchEvidence: [...searchEvidence],
    candidateBottles: new Map([[currentBottle.bottleId, currentBottle]]),
    resolvedEntities: new Map(),
    bottleContexts: new Map([
      [currentBottleContext.bottleId, currentBottleContext],
    ]),
    entityContexts: new Map(),
  };
  const webSearchBudget = createBottleWebSearchBudget(options.maxSearchQueries);
  const proposalCollector = createRunProposalCollector({
    sourceFields: getBottleCheckSourceEvidencePaths({
      intent: "audit_bottle",
      input: audit,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [currentBottle],
        bottleContexts: [currentBottleContext],
      }),
    }),
    state,
  });
  const agent: BottleAuditAgent = new Agent({
    name: "bottle_auditor",
    instructions: buildBottleAuditInstructions(),
    model: options.model,
    modelSettings: {
      parallelToolCalls: false,
      ...getStableOpenAISettings(options.model),
    },
    outputType: BottleAuditAgentOutputType,
    tools: createBottleCheckTools({
      allowCandidateExpansion: true,
      dataSource,
      options,
      proposalCollector,
      state,
      webSearchBudget,
    }),
  });
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient: options.client,
      useResponses: true,
    }),
    workflowName: "Bottle Audit",
    groupId: conversationId,
    traceMetadata: {
      "gen_ai.conversation.id": conversationId,
      bottle_id: `${audit.bottleId}`,
      origin: audit.origin,
    },
  });
  observeRunnerTools(runner, options.observeToolEvent);
  const getArtifacts = () =>
    buildAgentArtifacts({
      extractedIdentity: null,
      imageEvidence: null,
      state,
    });

  return {
    agent,
    runner,
    input: buildAuditBottleAgentInput({
      audit,
      currentBottleContext,
      searchEvidence,
    }),
    conversationId,
    runOptions: {
      maxTurns: CLASSIFIER_MAX_TURNS,
      stream: false,
    },
    getArtifacts,
    getOutput: (result) => {
      mergeRunResultToolArtifacts(state, result);
      const finalOutput = getAgentFinalOutput(result);
      if (!finalOutput) {
        throw new Error("Agent returned empty output");
      }
      const parsed = BottleAuditAgentOutputSchema.parse(finalOutput);
      assertFindingsUseCollectedEvidence(parsed.findings, proposalCollector);
      return {
        ...parsed,
        proposedOperations: proposalCollector.getProposals(),
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
  ): Promise<{
    agentResult: BottleClassifierAgentResult;
    modelMetadata: BottleClassifierRunMetadata;
  }> => {
    try {
      return await startAgentSpan({
        name:
          preparedRun.instructionMode === "local_identification"
            ? "Bottle Local Identifier"
            : "Bottle Classifier",
        conversationId: preparedRun.conversationId,
        attributes: {
          ...preparedRun.spanAttributes,
          "bottle_classifier.initial_candidate_count":
            preparedRun.getArtifacts().candidates.length,
        },
        callback: async () => {
          const startedAt = performance.now();
          const result = await preparedRun.runner.run(
            preparedRun.agent,
            preparedRun.input,
            preparedRun.runOptions,
          );

          return {
            agentResult: preparedRun.getAgentResult(result),
            modelMetadata: getBottleClassifierRunMetadata({
              result,
              durationMs: performance.now() - startedAt,
            }),
          };
        },
      });
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
    imageEvidence,
    initialCandidates = [],
    candidateExpansion = "open",
    searchEvidence = [],
    resolvedEntities = [],
    investigationHint = null,
    identityAnchor = null,
    webSearchBudget,
    instructionMode = "classification",
    conversationId,
  }: RunBottleClassifierAgentInput): Promise<BottleClassifierAgentRun> => {
    const resolvedConversationId = buildClassifierConversationId(
      reference,
      instructionMode,
      conversationId,
    );

    if (options.overrides?.runBottleClassifierAgent) {
      const agentResult = await options.overrides.runBottleClassifierAgent({
        reference,
        conversationId: resolvedConversationId,
        extractedIdentity,
        imageEvidence,
        initialCandidates,
        candidateExpansion,
        searchEvidence,
        resolvedEntities,
        investigationHint,
        identityAnchor,
        webSearchBudget,
        instructionMode,
      });

      return {
        modelMetadata: null,
        agentResult: {
          ...agentResult,
          artifacts: buildBottleClassificationArtifacts({
            ...agentResult.artifacts,
            searchEvidence: mergeSearchEvidenceList(
              searchEvidence,
              agentResult.artifacts.searchEvidence,
            ),
            resolvedEntities: [
              ...resolvedEntities,
              ...agentResult.artifacts.resolvedEntities,
            ],
          }),
        },
        webSearchBudget,
      };
    }

    const preparedRun = await prepareBottleClassifierAgentRun(options, {
      reference,
      conversationId: resolvedConversationId,
      initialCandidates,
      extractedIdentity,
      imageEvidence,
      candidateExpansion,
      searchEvidence,
      resolvedEntities,
      investigationHint,
      identityAnchor,
      webSearchBudget,
      instructionMode,
    });

    const run = await runPreparedBottleClassifierAgent(preparedRun);
    return {
      ...run,
      webSearchBudget: preparedRun.webSearchBudget,
    };
  };

  const runBottleClassifierAgent = async (
    input: RunBottleClassifierAgentInput,
  ): Promise<BottleClassifierAgentResult> => {
    const { agentResult } = await runBottleClassifierAgentWithBudget(input);
    return agentResult;
  };

  const runBottleAudit = async (
    input: AuditBottleInput,
  ): Promise<BottleAuditRun> => {
    const parsedInput = AuditBottleInputSchema.parse(input);
    const conversationId = `bottle_audit:${parsedInput.bottleId}`;
    let artifacts = buildBottleClassificationArtifacts({});

    try {
      const dataSource = getBottleClassifierDataSource(options);
      const loadBottleContext = createBottleContextLoader({
        dataSource,
        options,
      });
      if (!loadBottleContext) {
        throw new Error(
          "Bottle audits require the getBottleContext data-source capability.",
        );
      }

      const currentBottleContext = await loadBottleContext(
        parsedInput.bottleId,
      );
      if (!currentBottleContext) {
        throw new Error(`Bottle ${parsedInput.bottleId} was not found.`);
      }
      if (currentBottleContext.bottleId !== parsedInput.bottleId) {
        throw new Error("Bottle audit data source returned the wrong Bottle.");
      }
      const currentBottle = bottleContextToCandidate(currentBottleContext);

      artifacts = buildBottleClassificationArtifacts({
        candidates: [currentBottle],
        bottleContexts: [currentBottleContext],
      });

      let output: BottleAuditAgentOutput;
      let modelMetadata: BottleClassifierRunMetadata | null = null;
      if (options.overrides?.runBottleAuditAgent) {
        const overridden = await options.overrides.runBottleAuditAgent({
          audit: parsedInput,
          currentBottleContext,
          conversationId,
        });
        const { proposedOperations, ...finalOutput } = overridden;
        output = {
          ...BottleAuditAgentOutputSchema.parse(finalOutput),
          proposedOperations:
            ProposedOperationsSchema.parse(proposedOperations),
        };
      } else {
        const preparedRun = prepareBottleAuditAgentRun(options, {
          audit: parsedInput,
          currentBottleContext,
          conversationId,
        });
        output = await startAgentSpan({
          name: "Bottle Auditor",
          conversationId: preparedRun.conversationId,
          attributes: {
            "gen_ai.request.model": options.model,
            "bottle_classifier.instruction_mode": "audit",
            "bottle_classifier.current_bottle_id": `${parsedInput.bottleId}`,
          },
          callback: async () => {
            const startedAt = performance.now();
            const result = await preparedRun.runner.run(
              preparedRun.agent,
              preparedRun.input,
              preparedRun.runOptions,
            );
            modelMetadata = getBottleClassifierRunMetadata({
              result,
              durationMs: performance.now() - startedAt,
            });
            try {
              return preparedRun.getOutput(result);
            } finally {
              artifacts = preparedRun.getArtifacts();
            }
          },
        });
      }

      return {
        result: createAuditBottleResult({
          ...output,
          artifacts,
        }),
        modelMetadata,
      };
    } catch (error) {
      if (error instanceof BottleClassificationError) {
        throw error;
      }

      throw new BottleClassificationError(
        error instanceof Error ? error.message : "Unknown Bottle audit error",
        artifacts,
        {
          cause: error,
        },
      );
    }
  };

  const auditBottle = async (
    input: AuditBottleInput,
  ): Promise<AuditBottleResult> => (await runBottleAudit(input)).result;

  const runBottleReference = async (
    input: ClassifyBottleReferenceInput,
  ): Promise<BottleReferenceRun> => {
    const parsedInput = ClassifyBottleReferenceInputSchema.parse(input);
    const conversationId = buildClassifierConversationId(
      parsedInput.reference,
      "classification",
      parsedInput.conversationId,
    );
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
        imageEvidence: parsedInput.imageEvidence ?? null,
      });

      const autoIgnoreReason = getAutoIgnoreBottleReferenceReason(
        parsedInput.reference.name,
        artifacts.extractedIdentity,
      );
      if (autoIgnoreReason) {
        return {
          result: BottleClassificationResultSchema.parse(
            createIgnoredReferenceClassification(autoIgnoreReason, artifacts),
          ),
          modelMetadata: null,
        };
      }

      const candidates = await resolveInitialCandidates({
        reference: parsedInput.reference,
        extractedIdentity,
        initialCandidates: parsedInput.initialCandidates,
      });

      artifacts = buildBottleClassificationArtifacts({
        extractedIdentity,
        imageEvidence: parsedInput.imageEvidence ?? null,
        candidates,
      });

      const deterministicDecision = resolveDeterministicBottleReference({
        reference: parsedInput.reference,
        artifacts,
      });

      const resolvedEntities = await collectInitialResolvedEntities({
        candidateExpansion: parsedInput.candidateExpansion,
        extractedIdentity,
        initialCandidates: artifacts.candidates,
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

      const agentRun = await runBottleClassifierAgentWithBudget({
        reference: parsedInput.reference,
        conversationId,
        extractedIdentity: artifacts.extractedIdentity,
        imageEvidence: artifacts.imageEvidence,
        initialCandidates: artifacts.candidates,
        candidateExpansion: parsedInput.candidateExpansion,
        searchEvidence: artifacts.searchEvidence,
        resolvedEntities: artifacts.resolvedEntities,
        identityAnchor: deterministicDecision,
        investigationHint:
          [
            deterministicDecision
              ? "A closed-form deterministic identity anchor is included in the input. Preserve it unless stronger inspected evidence proves the anchor was applied to the wrong catalog row."
              : null,
            artifacts.searchEvidence.length > 0
              ? "Web evidence was gathered before reasoning. Judge source quality from the evidence content, discard weak or irrelevant results, and use local search tools if the evidence suggests a better database candidate."
              : null,
            hasContainedSourceEntityCandidate({
              extractedIdentity: artifacts.extractedIdentity,
              resolvedEntities: artifacts.resolvedEntities,
            })
              ? "A contained local entity candidate was retrieved for an explicit source brand, bottler, or distillery field. Containment is candidate evidence only: resolve equivalence from product evidence before selecting its id, and do not propose a new null-id entity without reviewing that candidate."
              : null,
          ]
            .filter((hint): hint is string => hint !== null)
            .join(" ") || null,
        webSearchBudget,
      });
      const finalized = await finalizeBottleClassifierAgentResult({
        reference: parsedInput.reference,
        agentResult: agentRun.agentResult,
      });
      artifacts = finalized.artifacts;

      return {
        result: BottleClassificationResultSchema.parse(
          createDecidedBottleClassification({
            decision: finalized.decision,
            proposedOperations: agentRun.agentResult.proposedOperations ?? [],
            findings: agentRun.agentResult.findings ?? [],
            artifacts,
          }),
        ),
        modelMetadata: agentRun.modelMetadata,
      };
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

  const classifyBottleReference = async (
    input: ClassifyBottleReferenceInput,
  ): Promise<BottleClassificationResult> =>
    (await runBottleReference(input)).result;

  const identifyExistingBottleReference = async (
    input: ClassifyBottleReferenceInput,
  ): Promise<BottleClassificationResult> => {
    const parsedInput = ClassifyBottleReferenceInputSchema.parse(input);
    const conversationId = buildClassifierConversationId(
      parsedInput.reference,
      "local_identification",
      parsedInput.conversationId,
    );
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
        imageEvidence: parsedInput.imageEvidence ?? null,
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
        imageEvidence: parsedInput.imageEvidence ?? null,
        candidates,
      });

      const deterministicDecision = resolveDeterministicBottleReference({
        reference: parsedInput.reference,
        artifacts,
      });
      if (candidates.length === 0) {
        return BottleClassificationResultSchema.parse(
          createDecidedBottleClassification({
            decision: {
              action: "no_match",
              rationale:
                "Local identification found no existing Bottle candidates.",
              candidateBottleIds: [],
              identityScope: "product",
              observation: null,
              identityBasis: null,
              confidenceBasis: {
                positiveEvidence: [],
                unresolvedRisks: [
                  {
                    category: "insufficient_evidence",
                    note: "No local candidates were found.",
                  },
                ],
                toolsUsed: ["initial_local_candidates"],
                webEvidence: "not_used",
              },
              matchedBottleId: null,
              proposedBottle: null,
            },
            artifacts,
          }),
        );
      }
      if (deterministicDecision?.action === "match") {
        return BottleClassificationResultSchema.parse(
          createDecidedBottleClassification({
            decision: deterministicDecision,
            artifacts,
          }),
        );
      }
      if (deterministicDecision) {
        return BottleClassificationResultSchema.parse(
          createDecidedBottleClassification({
            decision: createLocalIdentificationNoMatch({
              decision: deterministicDecision,
              artifacts,
            }),
            artifacts,
          }),
        );
      }

      const agentRun = await runBottleClassifierAgentWithBudget({
        reference: parsedInput.reference,
        conversationId,
        extractedIdentity: artifacts.extractedIdentity,
        imageEvidence: artifacts.imageEvidence,
        initialCandidates: artifacts.candidates,
        candidateExpansion: "initial_only",
        searchEvidence: [],
        resolvedEntities: [],
        investigationHint: null,
        webSearchBudget: createBottleWebSearchBudget(0),
        instructionMode: "local_identification",
      });
      const { decision, artifacts: agentArtifacts } =
        await finalizeBottleClassifierAgentResult({
          reference: parsedInput.reference,
          agentResult: agentRun.agentResult,
        });

      return BottleClassificationResultSchema.parse(
        createDecidedBottleClassification({
          decision:
            decision.action === "match"
              ? normalizeLocalIdentificationMatch(decision)
              : createLocalIdentificationNoMatch({
                  decision,
                  artifacts: agentArtifacts,
                }),
          artifacts: agentArtifacts,
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
    auditBottle,
    runBottleAudit,
    runBottleReference,
    classifyBottleReference,
    identifyExistingBottleReference,
    runBottleClassifierAgent,
    extractBottleReferenceIdentity,
    extractFromImage,
    extractFromText,
  };
}
