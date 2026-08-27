import {
  Agent,
  OpenAIProvider,
  Runner,
  type JsonSchemaDefinition,
  type NonStreamRunOptions,
} from "@openai/agents";
import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
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
  type ProposedOperation,
} from "./contract";
import { BottleClassificationError } from "./error";
import { createWhiskyLabelExtractor } from "./extractor";
import type { ImageBottleEvidence } from "./imageEvidence";
import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
} from "./instructions";
import { startAgentSpan, type AgentSpanAttributes } from "./observability";
import {
  getStableOpenAISettings,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";
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
import { createBottleWebSearchBudget } from "./tools";
import type { BottleWebSearchBudget } from "./tools/sharedWebSearch";
export { createBottleContextLoader } from "./runtime/bottleCheckContext";
export type {
  BottleClassifierDataSource,
  BottleClassifierToolEvent,
} from "./runtime/bottleCheckRuntime";

const CLASSIFIER_MAX_TURNS = 8;
// Parallel tool calls are disabled, and the agent needs one final-output turn.
const CLASSIFIER_MAX_PROPOSED_OPERATIONS = CLASSIFIER_MAX_TURNS - 1;
const MAX_CANDIDATE_ENTITY_SEARCH_REQUESTS = 12;

export type BottleClassifierAgentResult = {
  decision: BottleClassifierAgentDecisionInput;
  artifacts: BottleClassificationArtifacts;
};

const BottleReferenceAgentOutputSchema = BottleClassifierAgentDecisionSchema;

const BottleAuditAgentOutputSchema = z
  .object({
    summary: z.string().trim().min(1),
    findings: z.array(FindingSchema).default([]),
  })
  .strict();

const JsonValueSchema = z.json();
const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
type JsonValue = z.infer<typeof JsonValueSchema>;
const AgentOutputJsonSchema = z.discriminatedUnion("additionalProperties", [
  z
    .object({
      type: z.literal("object"),
      properties: z.record(z.string(), JsonObjectSchema),
      required: z.array(z.string()),
      additionalProperties: z.literal(false),
      description: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("object"),
      properties: z.record(z.string(), JsonObjectSchema),
      required: z.array(z.string()),
      additionalProperties: z.literal(true),
      description: z.string().optional(),
    })
    .passthrough(),
]);

function stripProviderUnsupportedFormats(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(stripProviderUnsupportedFormats);
  }
  const objectValue = z.record(z.string(), JsonValueSchema).safeParse(value);
  if (!objectValue.success) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(objectValue.data).flatMap(([key, child]) =>
      key === "format" ? [] : [[key, stripProviderUnsupportedFormats(child)]],
    ),
  );
}

function createAgentOutputType(
  name: string,
  schema: z.ZodObject,
): JsonSchemaDefinition {
  // The OpenAI helper makes nullable optional fields required on the wire and
  // rejects optional non-nullable fields before the provider request.
  const generatedSchema = zodTextFormat(schema, name).schema;
  // Zod attaches non-JSON Standard Schema metadata to the generated object.
  // The provider contract owns only its serialized JSON representation.
  const providerSchema = JsonObjectSchema.parse(
    JSON.parse(JSON.stringify(generatedSchema)),
  );
  return {
    type: "json_schema",
    name,
    strict: true,
    schema: AgentOutputJsonSchema.parse(
      stripProviderUnsupportedFormats(providerSchema),
    ),
  };
}

const BottleReferenceAgentOutputType = createAgentOutputType(
  "bottle_reference_output",
  BottleReferenceAgentOutputSchema,
);

const BottleAuditAgentOutputType = createAgentOutputType(
  "bottle_audit_output",
  BottleAuditAgentOutputSchema,
);

export type BottleAuditAgentOutput = z.infer<
  typeof BottleAuditAgentOutputSchema
> & {
  proposedOperations: ProposedOperation[];
};

export type RunBottleAuditAgentInput = {
  audit: AuditBottleInput;
  reference?: BottleReference;
  extractedIdentity?: BottleExtractedDetails | null;
  imageEvidence?: ImageBottleEvidence | null;
  initialCandidates?: BottleCandidate[];
  resolvedEntities?: EntityResolution[];
  identityAnchor?: BottleClassificationDecision | null;
  webSearchBudget?: BottleWebSearchBudget;
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
  identityAnchor?: BottleClassificationDecision | null;
  webSearchBudget?: BottleWebSearchBudget;
};

export type BottleClassifierAdapters = BottleClassifierDataSource;

export type BottleAgentRunResult = {
  finalOutput?: unknown;
  newItems?: unknown[];
  state?: unknown;
  runContext?: unknown;
  usage?: unknown;
};

type BaseCreateBottleClassifierOptions = {
  client: OpenAI;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageExtractionModel?: string;
  imageExtractionReasoningEffort?: OpenAIReasoningEffort;
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
    runPreparedBottleClassifierAgent?: (
      preparedRun: PreparedBottleClassifierAgentRun,
    ) => Promise<BottleAgentRunResult>;
    runPreparedBottleAuditAgent?: (
      preparedRun: PreparedBottleAuditAgentRun,
    ) => Promise<BottleAgentRunResult>;
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
  getAgentResult: (
    result: Parameters<typeof getAgentFinalOutput>[0],
  ) => BottleClassifierAgentResult;
  input: string;
  conversationId: string;
  spanAttributes: AgentSpanAttributes;
  runOptions: NonStreamRunOptions<unknown, BottleClassifierAgent>;
  runner: Runner;
  webSearchBudget: BottleWebSearchBudget;
};

function buildClassifierConversationId(
  reference: BottleReference,
  conversationId?: string,
) {
  const explicitConversationId = conversationId?.trim();
  if (explicitConversationId) {
    return explicitConversationId;
  }

  const id =
    reference.id === undefined || reference.id === null || reference.id === ""
      ? randomUUID()
      : reference.id;

  return `bottle_reference:${id}`;
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
  // Extracted roles are hypotheses. A consumer Brand can be mislabeled as a
  // series, so expose that local Brand candidate without rewriting the source.
  addEntitySearchRequest(requests, seen, extractedIdentity.series, "brand");
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
    identityAnchor = null,
    webSearchBudget: inputWebSearchBudget,
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
  const instructions = buildBottleClassifierInstructions();
  const tools = createBottleCheckTools({
    allowCandidateExpansion,
    dataSource,
    options,
    proposalCollector: null,
    state,
    webSearchBudget,
  });

  const agent: BottleClassifierAgent = new Agent({
    name: "bottle_classifier_reasoner",
    instructions,
    model: options.model,
    modelSettings: {
      parallelToolCalls: false,
      ...getStableOpenAISettings(options.model, options.reasoningEffort),
    },
    outputType: BottleReferenceAgentOutputType,
    tools,
  });
  const resolvedConversationId = buildClassifierConversationId(
    reference,
    conversationId,
  );
  const runner = new Runner({
    tracingDisabled: true,
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
    searchEvidence: state.searchEvidence,
    resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
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
    spanAttributes: {
      "gen_ai.request.model": options.model,
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
      const decision = BottleReferenceAgentOutputSchema.parse(finalOutput);
      return {
        decision: parseAgentDecision(decision),
        artifacts: getArtifacts(),
      };
    },
  };
}

export type PreparedBottleAuditAgentRun = {
  agent: BottleAuditAgent;
  conversationId: string;
  getArtifacts: () => BottleClassificationArtifacts;
  getOutput: (
    result: Parameters<typeof getAgentFinalOutput>[0],
  ) => BottleAuditAgentOutput;
  input: string;
  runOptions: NonStreamRunOptions<unknown, BottleAuditAgent>;
  runner: Runner;
};

export function prepareBottleAuditAgentRun(
  options: CreateBottleClassifierOptions,
  {
    audit,
    reference,
    extractedIdentity,
    imageEvidence,
    initialCandidates,
    resolvedEntities = [],
    identityAnchor = null,
    webSearchBudget: inputWebSearchBudget,
    currentBottleContext,
    conversationId,
    searchEvidence = [],
  }: RunBottleAuditAgentInput,
): PreparedBottleAuditAgentRun {
  const dataSource = getBottleClassifierDataSource(options);
  const currentBottle = bottleContextToCandidate(currentBottleContext);
  const normalizedReference: BottleReference = reference ?? {
    id: `audit:${audit.bottleId}`,
    name: currentBottleContext.fullName,
    url: null,
    imageUrl: currentBottleContext.publicImages[0]?.url ?? null,
    currentBottleId: audit.bottleId,
  };
  const normalizedExtractedIdentity =
    extractedIdentity !== undefined
      ? extractedIdentity
      : (currentBottleContext.publicImages.find(
          ({ labelEvidence }) => labelEvidence.extractedIdentity !== null,
        )?.labelEvidence.extractedIdentity ?? null);
  const state: BottleClassifierAgentRunState = {
    searchEvidence: [...searchEvidence],
    candidateBottles: new Map(),
    resolvedEntities: new Map(),
    bottleContexts: new Map([
      [currentBottleContext.bottleId, currentBottleContext],
    ]),
    entityContexts: new Map(),
  };
  for (const candidate of initialCandidates ?? []) {
    mergeBottleCandidate(state.candidateBottles, candidate);
  }
  mergeBottleCandidate(state.candidateBottles, currentBottle);
  for (const entity of resolvedEntities) {
    mergeResolvedEntity(state.resolvedEntities, entity);
  }
  const webSearchBudget =
    inputWebSearchBudget ??
    createBottleWebSearchBudget(options.maxSearchQueries);
  const availableSourceEvidenceFields = getBottleCheckSourceEvidencePaths({
    intent: "audit_bottle",
    input: audit,
    artifacts: buildBottleClassificationArtifacts({
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence: imageEvidence ?? null,
      candidates: sortedBottleCandidates(state.candidateBottles),
      resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
      bottleContexts: [currentBottleContext],
    }),
  });
  const proposalCollector = createRunProposalCollector({
    maxProposals: CLASSIFIER_MAX_PROPOSED_OPERATIONS,
    sourceFields: availableSourceEvidenceFields,
    state,
  });
  const agent: BottleAuditAgent = new Agent({
    name: "bottle_auditor",
    instructions: buildBottleAuditInstructions(),
    model: options.model,
    modelSettings: {
      parallelToolCalls: false,
      ...getStableOpenAISettings(options.model, options.reasoningEffort),
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
    tracingDisabled: true,
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
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence: imageEvidence ?? null,
      state,
    });

  return {
    agent,
    runner,
    input: buildAuditBottleAgentInput({
      audit,
      reference: normalizedReference,
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence,
      initialCandidates: sortedBottleCandidates(state.candidateBottles),
      currentBottleContext,
      searchEvidence: state.searchEvidence,
      resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
      identityAnchor,
      availableSourceEvidenceFields,
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
    reasoningEffort: options.reasoningEffort,
    imageModel: options.imageExtractionModel,
    imageReasoningEffort: options.imageExtractionReasoningEffort,
  });

  const extractFromImage = async (imageUrlOrBase64: string) =>
    options.overrides?.extractFromImage
      ? await options.overrides.extractFromImage(imageUrlOrBase64)
      : await extractor.extractFromImage(imageUrlOrBase64);

  const extractFromText = async (label: string) =>
    options.overrides?.extractFromText
      ? await options.overrides.extractFromText(label)
      : await extractor.extractFromText(label);

  const extractBottleReferenceIdentityWithSource = async (
    reference: Pick<BottleReference, "name" | "imageUrl">,
  ): Promise<{
    identity: BottleExtractedDetails | null;
    source: "image" | "text";
  }> => {
    let imageExtractionError: Error | null = null;

    if (reference.imageUrl) {
      try {
        const extractedFromImage = await extractFromImage(reference.imageUrl);
        if (extractedFromImage) {
          return { identity: extractedFromImage, source: "image" };
        }
      } catch (error) {
        imageExtractionError =
          error instanceof Error ? error : new Error(String(error));
      }
    }

    try {
      return {
        identity: await extractFromText(reference.name),
        source: "text",
      };
    } catch (error) {
      if (imageExtractionError) {
        throw imageExtractionError;
      }
      throw error;
    }
  };

  const extractBottleReferenceIdentity = async (
    reference: Pick<BottleReference, "name" | "imageUrl">,
  ): Promise<BottleExtractedDetails | null> =>
    (await extractBottleReferenceIdentityWithSource(reference)).identity;

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

  const prepareBottleReferenceEvidence = async ({
    reference,
    extractedIdentity: suppliedExtractedIdentity,
    extractedIdentitySource: suppliedExtractedIdentitySource,
    imageEvidence,
    initialCandidates,
    candidateExpansion,
    allowAutoIgnore = true,
  }: Pick<
    ClassifyBottleReferenceInput,
    | "reference"
    | "extractedIdentity"
    | "extractedIdentitySource"
    | "imageEvidence"
    | "initialCandidates"
  > & {
    candidateExpansion: CandidateExpansionMode;
    allowAutoIgnore?: boolean;
  }) => {
    const deterministicIdentitySeed = getDeterministicIdentitySeed(reference);
    const extractedReference =
      suppliedExtractedIdentity !== undefined
        ? {
            identity: suppliedExtractedIdentity,
            source: suppliedExtractedIdentitySource ?? null,
          }
        : deterministicIdentitySeed
          ? { identity: deterministicIdentitySeed, source: "text" as const }
          : await extractBottleReferenceIdentityWithSource(reference);
    const rawExtractedIdentity = extractedReference.identity;
    const extractedIdentitySource: "image" | "text" | "structured" | null =
      extractedReference.source;
    const extractedIdentity = applyDeterministicIdentitySeed({
      reference,
      extractedIdentity: rawExtractedIdentity,
    });
    let preparedArtifacts = buildBottleClassificationArtifacts({
      extractedIdentity,
      extractedIdentitySource,
      imageEvidence: imageEvidence ?? null,
    });
    const autoIgnoreReason = getAutoIgnoreBottleReferenceReason(
      reference.name,
      preparedArtifacts.extractedIdentity,
    );

    if (autoIgnoreReason && allowAutoIgnore) {
      return {
        artifacts: preparedArtifacts,
        autoIgnoreReason,
        deterministicDecision: null,
        webSearchBudget: createBottleWebSearchBudget(options.maxSearchQueries),
      };
    }

    const candidates = await resolveInitialCandidates({
      reference,
      extractedIdentity,
      initialCandidates,
    });
    preparedArtifacts = buildBottleClassificationArtifacts({
      ...preparedArtifacts,
      candidates,
    });
    const deterministicDecision = resolveDeterministicBottleReference({
      reference,
      artifacts: preparedArtifacts,
    });
    const resolvedEntities = await collectInitialResolvedEntities({
      candidateExpansion,
      extractedIdentity,
      initialCandidates: preparedArtifacts.candidates,
      options,
    });
    preparedArtifacts = buildBottleClassificationArtifacts({
      ...preparedArtifacts,
      resolvedEntities,
    });
    const webSearchBudget = createBottleWebSearchBudget(
      options.maxSearchQueries,
    );

    return {
      artifacts: preparedArtifacts,
      autoIgnoreReason: null,
      deterministicDecision,
      webSearchBudget,
    };
  };

  const runPreparedBottleClassifierAgent = async (
    preparedRun: PreparedBottleClassifierAgentRun,
  ): Promise<{
    agentResult: BottleClassifierAgentResult;
    modelMetadata: BottleClassifierRunMetadata;
  }> => {
    try {
      return await startAgentSpan({
        name: "Bottle Classifier",
        conversationId: preparedRun.conversationId,
        attributes: {
          ...preparedRun.spanAttributes,
          "bottle_classifier.initial_candidate_count":
            preparedRun.getArtifacts().candidates.length,
        },
        callback: async () => {
          const startedAt = performance.now();
          const result = options.overrides?.runPreparedBottleClassifierAgent
            ? await options.overrides.runPreparedBottleClassifierAgent(
                preparedRun,
              )
            : await preparedRun.runner.run(
                preparedRun.agent,
                preparedRun.input,
                preparedRun.runOptions,
              );

          return {
            agentResult: preparedRun.getAgentResult(result),
            modelMetadata: getBottleClassifierRunMetadata({
              result,
              durationMs: performance.now() - startedAt,
              model: options.model,
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
    identityAnchor = null,
    webSearchBudget,
    conversationId,
  }: RunBottleClassifierAgentInput): Promise<BottleClassifierAgentRun> => {
    const resolvedConversationId = buildClassifierConversationId(
      reference,
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
        identityAnchor,
        webSearchBudget,
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
      identityAnchor,
      webSearchBudget,
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
      const preferredImage =
        currentBottleContext.publicImages.find(
          ({ source, labelEvidence }) =>
            source.kind === "bottle" &&
            labelEvidence.extractedIdentity !== null,
        ) ??
        currentBottleContext.publicImages.find(
          ({ labelEvidence }) => labelEvidence.extractedIdentity !== null,
        ) ??
        currentBottleContext.publicImages[0];
      const reference: BottleReference = {
        id: `audit:${parsedInput.bottleId}`,
        name: currentBottleContext.fullName,
        url: null,
        imageUrl: preferredImage?.url ?? null,
        currentBottleId: parsedInput.bottleId,
      };
      const preparedEvidence = await prepareBottleReferenceEvidence({
        reference,
        // The audited Bottle name seeds retrieval. A fallible image extraction
        // stays visible as context evidence but must not steer candidate search.
        extractedIdentity: null,
        imageEvidence: null,
        candidateExpansion: "open",
        allowAutoIgnore: false,
      });
      const initialCandidates = mergeCandidateLists(
        preparedEvidence.artifacts.candidates,
        [currentBottle],
      );
      artifacts = buildBottleClassificationArtifacts({
        ...preparedEvidence.artifacts,
        candidates: initialCandidates,
        bottleContexts: [currentBottleContext],
      });

      let output: BottleAuditAgentOutput;
      let modelMetadata: BottleClassifierRunMetadata | null = null;
      if (options.overrides?.runBottleAuditAgent) {
        const overridden = await options.overrides.runBottleAuditAgent({
          audit: parsedInput,
          reference,
          extractedIdentity: artifacts.extractedIdentity,
          imageEvidence: artifacts.imageEvidence,
          initialCandidates,
          resolvedEntities: artifacts.resolvedEntities,
          searchEvidence: artifacts.searchEvidence,
          identityAnchor: preparedEvidence.deterministicDecision,
          webSearchBudget: preparedEvidence.webSearchBudget,
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
          reference,
          extractedIdentity: artifacts.extractedIdentity,
          imageEvidence: artifacts.imageEvidence,
          initialCandidates,
          resolvedEntities: artifacts.resolvedEntities,
          searchEvidence: artifacts.searchEvidence,
          identityAnchor: preparedEvidence.deterministicDecision,
          webSearchBudget: preparedEvidence.webSearchBudget,
          currentBottleContext,
          conversationId,
        });
        const agentRun = await startAgentSpan({
          name: "Bottle Auditor",
          conversationId: preparedRun.conversationId,
          attributes: {
            "gen_ai.request.model": options.model,
            "bottle_classifier.instruction_mode": "audit",
            "bottle_classifier.current_bottle_id": `${parsedInput.bottleId}`,
          },
          callback: async () => {
            const startedAt = performance.now();
            const result = options.overrides?.runPreparedBottleAuditAgent
              ? await options.overrides.runPreparedBottleAuditAgent(preparedRun)
              : await preparedRun.runner.run(
                  preparedRun.agent,
                  preparedRun.input,
                  preparedRun.runOptions,
                );
            const runMetadata = getBottleClassifierRunMetadata({
              result,
              durationMs: performance.now() - startedAt,
              model: options.model,
            });
            try {
              return {
                output: preparedRun.getOutput(result),
                modelMetadata: runMetadata,
              };
            } finally {
              artifacts = preparedRun.getArtifacts();
            }
          },
        });
        output = agentRun.output;
        modelMetadata = agentRun.modelMetadata;
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
      parsedInput.conversationId,
    );
    let artifacts = buildBottleClassificationArtifacts({});
    try {
      const preparedEvidence = await prepareBottleReferenceEvidence({
        reference: parsedInput.reference,
        extractedIdentity: parsedInput.extractedIdentity,
        extractedIdentitySource: parsedInput.extractedIdentitySource,
        imageEvidence: parsedInput.imageEvidence,
        initialCandidates: parsedInput.initialCandidates,
        candidateExpansion: parsedInput.candidateExpansion,
      });
      artifacts = preparedEvidence.artifacts;
      if (preparedEvidence.autoIgnoreReason) {
        return {
          result: BottleClassificationResultSchema.parse(
            createIgnoredReferenceClassification(
              preparedEvidence.autoIgnoreReason,
              artifacts,
            ),
          ),
          modelMetadata: null,
        };
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
        identityAnchor: preparedEvidence.deterministicDecision,
        webSearchBudget: preparedEvidence.webSearchBudget,
      });
      const agentResult = {
        ...agentRun.agentResult,
        // Extraction provenance is runtime-owned. Agent output cannot replace it.
        artifacts: buildBottleClassificationArtifacts({
          ...agentRun.agentResult.artifacts,
          extractedIdentitySource: artifacts.extractedIdentitySource,
        }),
      };
      const finalized = await finalizeBottleClassifierAgentResult({
        reference: parsedInput.reference,
        agentResult,
      });
      artifacts = finalized.artifacts;

      return {
        result: BottleClassificationResultSchema.parse(
          createDecidedBottleClassification({
            decision: finalized.decision,
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

  return {
    auditBottle,
    runBottleAudit,
    runBottleReference,
    classifyBottleReference,
    runBottleClassifierAgent,
    extractBottleReferenceIdentity,
    extractFromImage,
    extractFromText,
  };
}
