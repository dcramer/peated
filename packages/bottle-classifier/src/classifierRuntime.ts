import {
  agentOutput,
  runAgent,
  type AgentOutput,
  type AgentRunResult,
  type AgentTool,
} from "@peated/agent-run";
import { randomUUID } from "node:crypto";
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
  type BottleReferenceInput,
  type CandidateExpansionMode,
  type ClassifyBottleReferenceInput,
  type ProposedOperation,
} from "./contract";
import { BottleClassificationError } from "./error";
import { createWhiskyLabelExtractor, type WhiskyLabelModel } from "./extractor";
import type { ImageBottleEvidence } from "./imageEvidence";
import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
} from "./instructions";
import {
  startClassifierRunSpan,
  type ClassifierSpanAttributes,
} from "./observability";
import {
  getStableOpenAISettings,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";
import {
  finalizeBottleReferenceClassification,
  getAutoIgnoreBottleReferenceReason,
  getPreExtractionAutoIgnoreBottleReferenceReason,
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
  buildAgentArtifacts,
  createBottleCheckTools,
  createRunProposalCollector,
  keepFindingsWithCollectedEvidence,
  mergeRunResultToolArtifacts,
  mergeSearchEvidence,
  observeAgentTools,
  sortedBottleCandidates,
  sortedResolvedEntities,
  type BottleClassifierAgentRunState,
  type BottleClassifierDataSource,
  type BottleClassifierToolEvent,
} from "./runtime/bottleCheckRuntime";
import {
  buildEntityRetrievalRecord,
  mergeBottleCandidate,
  mergeResolvedEntity,
} from "./runtime/candidates";
import { applyDeterministicIdentitySeed } from "./runtime/deterministic";
import {
  getBottleClassifierRunMetadata,
  type BottleClassifierRunMetadata,
} from "./runtime/runMetadata";
import type { BottleClassifierWeb, BottleWebSearchExecutor } from "./tools";
import { createBottleWebSearchBudget } from "./tools";
import type { BottleWebSearchBudget } from "./tools/sharedWebSearch";
export { createBottleContextLoader } from "./runtime/bottleCheckContext";
export type {
  BottleClassifierDataSource,
  BottleClassifierToolEvent,
} from "./runtime/bottleCheckRuntime";

// A run can use 17 turns for research and one to return its decision. Audits
// share the reference limit: new Bottles often need more inspections than an
// 8-turn cap allowed.
const REFERENCE_CLASSIFIER_MAX_TURNS = 18;
const AUDIT_CLASSIFIER_MAX_TURNS = 18;
// Tool calls run one at a time, so an audit keeps its last turn for the result.
const CLASSIFIER_MAX_PROPOSED_OPERATIONS = AUDIT_CLASSIFIER_MAX_TURNS - 1;
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

const BottleReferenceAgentOutputType = agentOutput(
  "bottle_reference_output",
  BottleReferenceAgentOutputSchema,
);

const BottleAuditAgentOutputType = agentOutput(
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
  reference?: BottleReferenceInput;
  extractedIdentity?: BottleExtractedDetails | null;
  imageEvidence?: ImageBottleEvidence | null;
  initialCandidates?: BottleCandidate[];
  resolvedEntities?: EntityResolution[];
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
  reference: BottleReferenceInput;
  conversationId?: string;
  extractedIdentity?: BottleExtractedDetails | null;
  imageEvidence?: ImageBottleEvidence | null;
  initialCandidates?: BottleCandidate[];
  candidateExpansion?: CandidateExpansionMode;
  readCandidateImages?: boolean;
  searchEvidence?: BottleSearchEvidence[];
  resolvedEntities?: EntityResolution[];
  webSearchBudget?: BottleWebSearchBudget;
  signal?: AbortSignal;
  onProgress?: BottleClassifierProgressObserver;
};

/**
 * Progress from one classifier run, for a caller that shows it while the run
 * continues. Candidates are Peated's own likely matches, found before the
 * model starts; tool events name each tool the model starts and finishes.
 */
export type BottleClassifierProgressEvent =
  | { type: "candidates"; candidates: BottleCandidate[] }
  | { type: "tool"; name: string; status: "started" | "finished" };

export type BottleClassifierProgressObserver = (
  event: BottleClassifierProgressEvent,
) => void;

export type BottleClassifierRunOptions = {
  signal?: AbortSignal;
  onProgress?: BottleClassifierProgressObserver;
};

export type BottleClassifierAdapters = BottleClassifierDataSource;

export type BottleAgentRunResult = AgentRunResult;

type BaseCreateBottleClassifierOptions = {
  /** Returns the AI SDK model for each model name the classifier uses. */
  languageModel: WhiskyLabelModel;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageExtractionModel?: string;
  imageExtractionReasoningEffort?: OpenAIReasoningEffort;
  maxSearchQueries: number;
  /** PeatedBot's page reader and search. Without it, the run has no web tools. */
  web?: BottleClassifierWeb | null;
  // Reviewed evidence collected before this run. Controlled evals use it so
  // prompt variants receive the same source facts.
  initialSearchEvidence?: BottleSearchEvidence[];
  executeWebSearch?: BottleWebSearchExecutor;
  observeToolEvent?: (event: BottleClassifierToolEvent) => void;
  observeReferenceAgentDecision?: (
    decision: BottleClassifierAgentDecisionInput,
  ) => void;
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
    options?: BottleClassifierRunOptions,
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
    reference: Pick<BottleReferenceInput, "name" | "imageUrl">,
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

/** One agent run: what the model sees and the turn limit. */
export type PreparedAgentRequest = {
  instructions: string;
  output: AgentOutput;
  input: string;
  tools: AgentTool[];
  maxTurns: number;
  signal?: AbortSignal;
};

export type PreparedBottleClassifierAgentRun = PreparedAgentRequest & {
  getArtifacts: () => BottleClassificationArtifacts;
  getAgentResult: (result: AgentRunResult) => BottleClassifierAgentResult;
  conversationId: string;
  spanAttributes: ClassifierSpanAttributes;
  webSearchBudget: BottleWebSearchBudget;
};

function buildClassifierConversationId(
  reference: BottleReferenceInput,
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
  maxRequests = Number.POSITIVE_INFINITY,
) {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) {
    return;
  }

  const key = normalizedQuery.toLowerCase();
  if (seen.has(key) || requests.length >= maxRequests) {
    return;
  }

  seen.add(key);
  requests.push({
    query: normalizedQuery,
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
  addEntitySearchRequest(requests, seen, extractedIdentity.brand);
  // Extracted Bottle relationships are hypotheses. A consumer Brand can be mislabeled as a
  // series, so expose that local Brand candidate without rewriting the source.
  addEntitySearchRequest(requests, seen, extractedIdentity.series);
  addEntitySearchRequest(requests, seen, extractedIdentity.bottler);
  for (const distillery of extractedIdentity.distillery ?? []) {
    addEntitySearchRequest(requests, seen, distillery);
  }
  const maxRequests = requests.length + MAX_CANDIDATE_ENTITY_SEARCH_REQUESTS;
  for (const candidate of initialCandidates) {
    addEntitySearchRequest(requests, seen, candidate.brand, maxRequests);
    addEntitySearchRequest(requests, seen, candidate.bottler, maxRequests);
    for (const distillery of candidate.distillery) {
      addEntitySearchRequest(requests, seen, distillery, maxRequests);
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
          buildEntityRetrievalRecord(request.query, entity.source),
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
  reference: BottleReferenceInput;
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
    readCandidateImages = true,
    searchEvidence = [],
    resolvedEntities = [],
    webSearchBudget: inputWebSearchBudget,
    conversationId,
    signal,
    onProgress,
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
  const hasExactReferenceMatch = initialCandidates.some((candidate) =>
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
    readCandidateImages,
    dataSource,
    options,
    proposalCollector: null,
    state,
    webSearchBudget,
  });

  const resolvedConversationId = buildClassifierConversationId(
    reference,
    conversationId,
  );
  let observedTools = observeAgentTools(tools, options.observeToolEvent);
  if (onProgress) {
    observedTools = observeAgentTools(observedTools, (event) => {
      onProgress({
        type: "tool",
        name: event.name,
        status: event.type === "tool_call" ? "started" : "finished",
      });
    });
  }
  const input = buildAgentInput({
    reference,
    extractedIdentity: normalizedExtractedIdentity,
    imageEvidence: normalizedImageEvidence,
    initialCandidates,
    currentBottle,
    hasExactReferenceMatch,
    searchEvidence: state.searchEvidence,
    resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
  });
  const getArtifacts = () =>
    buildAgentArtifacts({
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence: normalizedImageEvidence,
      state,
    });
  return {
    instructions,
    output: BottleReferenceAgentOutputType,
    tools: observedTools,
    maxTurns: REFERENCE_CLASSIFIER_MAX_TURNS,
    signal,
    input,
    conversationId: resolvedConversationId,
    spanAttributes: {
      "bottle_classifier.reference_id":
        reference.id === undefined || reference.id === null
          ? "none"
          : `${reference.id}`,
      "bottle_classifier.current_bottle_id":
        reference.currentBottleId == null
          ? "none"
          : `${reference.currentBottleId}`,
    },
    webSearchBudget,
    getArtifacts,
    getAgentResult: (result) => {
      mergeRunResultToolArtifacts(state, result);

      const finalOutput = result.output;
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

export type PreparedBottleAuditAgentRun = PreparedAgentRequest & {
  conversationId: string;
  getArtifacts: () => BottleClassificationArtifacts;
  getOutput: (result: AgentRunResult) => BottleAuditAgentOutput;
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
    webSearchBudget: inputWebSearchBudget,
    currentBottleContext,
    conversationId,
    searchEvidence = [],
  }: RunBottleAuditAgentInput,
): PreparedBottleAuditAgentRun {
  const dataSource = getBottleClassifierDataSource(options);
  const currentBottle = bottleContextToCandidate(currentBottleContext);
  const normalizedReference: BottleReferenceInput = reference ?? {
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
  const tools = observeAgentTools(
    createBottleCheckTools({
      allowCandidateExpansion: true,
      dataSource,
      options,
      proposalCollector,
      state,
      webSearchBudget,
    }),
    options.observeToolEvent,
  );
  const getArtifacts = () =>
    buildAgentArtifacts({
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence: imageEvidence ?? null,
      state,
    });

  return {
    instructions: buildBottleAuditInstructions(),
    output: BottleAuditAgentOutputType,
    tools,
    maxTurns: AUDIT_CLASSIFIER_MAX_TURNS,
    input: buildAuditBottleAgentInput({
      audit,
      reference: normalizedReference,
      extractedIdentity: normalizedExtractedIdentity,
      imageEvidence,
      initialCandidates: sortedBottleCandidates(state.candidateBottles),
      currentBottleContext,
      searchEvidence: state.searchEvidence,
      resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
      availableSourceEvidenceFields,
    }),
    conversationId,
    getArtifacts,
    getOutput: (result) => {
      mergeRunResultToolArtifacts(state, result);
      const finalOutput = result.output;
      if (!finalOutput) {
        throw new Error("Agent returned empty output");
      }
      const parsed = BottleAuditAgentOutputSchema.parse(finalOutput);
      return {
        ...parsed,
        findings: keepFindingsWithCollectedEvidence(
          parsed.findings,
          proposalCollector,
        ),
        proposedOperations: proposalCollector.getProposals(),
      };
    },
  };
}

export function createBottleClassifier(
  options: CreateBottleClassifierOptions,
): BottleClassifier {
  const runPreparedAgent = async (
    preparedRun: PreparedAgentRequest,
    functionId: string,
  ) => {
    const settings = getStableOpenAISettings(
      options.model,
      options.reasoningEffort,
    );
    return await runAgent({
      model: options.languageModel(options.model),
      functionId,
      instructions: preparedRun.instructions,
      input: preparedRun.input,
      tools: preparedRun.tools,
      output: preparedRun.output,
      maxTurns: preparedRun.maxTurns,
      temperature: settings.temperature,
      reasoning: settings.reasoning?.effort,
      signal: preparedRun.signal,
    });
  };
  const extractor = createWhiskyLabelExtractor({
    languageModel: options.languageModel,
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
    reference: Pick<BottleReferenceInput, "name" | "imageUrl">,
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
    reference: Pick<BottleReferenceInput, "name" | "imageUrl">,
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
    const preExtractionAutoIgnoreReason =
      suppliedExtractedIdentity === undefined && allowAutoIgnore
        ? getPreExtractionAutoIgnoreBottleReferenceReason(reference.name)
        : null;
    if (preExtractionAutoIgnoreReason) {
      return {
        artifacts: buildBottleClassificationArtifacts({
          extractedIdentity: null,
          extractedIdentitySource: null,
          imageEvidence: imageEvidence ?? null,
          searchEvidence: options.initialSearchEvidence ?? [],
        }),
        autoIgnoreReason: preExtractionAutoIgnoreReason,
        webSearchBudget: createBottleWebSearchBudget(options.maxSearchQueries),
      };
    }

    const extractedReference =
      suppliedExtractedIdentity !== undefined
        ? {
            identity: suppliedExtractedIdentity,
            source: suppliedExtractedIdentitySource ?? null,
          }
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
      searchEvidence: options.initialSearchEvidence ?? [],
    });
    const autoIgnoreReason = getAutoIgnoreBottleReferenceReason(
      reference.name,
      preparedArtifacts.extractedIdentity,
    );

    if (autoIgnoreReason && allowAutoIgnore) {
      return {
        artifacts: preparedArtifacts,
        autoIgnoreReason,
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
      return await startClassifierRunSpan({
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
            : await runPreparedAgent(preparedRun, "bottle_classifier");

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
    readCandidateImages = true,
    searchEvidence = [],
    resolvedEntities = [],
    webSearchBudget,
    conversationId,
    signal,
    onProgress,
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
        readCandidateImages,
        searchEvidence,
        resolvedEntities,
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
      readCandidateImages,
      searchEvidence,
      resolvedEntities,
      webSearchBudget,
      signal,
      onProgress,
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
      const reference: BottleReferenceInput = {
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
        searchEvidence: options.initialSearchEvidence ?? [],
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
          webSearchBudget: preparedEvidence.webSearchBudget,
          currentBottleContext,
          conversationId,
        });
        const agentRun = await startClassifierRunSpan({
          name: "Bottle Auditor",
          conversationId: preparedRun.conversationId,
          attributes: {
            "bottle_classifier.instruction_mode": "audit",
            "bottle_classifier.current_bottle_id": `${parsedInput.bottleId}`,
          },
          callback: async () => {
            const startedAt = performance.now();
            const result = options.overrides?.runPreparedBottleAuditAgent
              ? await options.overrides.runPreparedBottleAuditAgent(preparedRun)
              : await runPreparedAgent(preparedRun, "bottle_audit");
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
    runOptions: BottleClassifierRunOptions = {},
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

      const agentInput: RunBottleClassifierAgentInput = {
        reference: parsedInput.reference,
        conversationId,
        extractedIdentity: artifacts.extractedIdentity,
        imageEvidence: artifacts.imageEvidence,
        initialCandidates: artifacts.candidates,
        candidateExpansion: parsedInput.candidateExpansion,
        readCandidateImages: parsedInput.readCandidateImages,
        searchEvidence: artifacts.searchEvidence,
        resolvedEntities: artifacts.resolvedEntities,
        webSearchBudget: preparedEvidence.webSearchBudget,
      };
      if (runOptions.signal) agentInput.signal = runOptions.signal;
      if (runOptions.onProgress) {
        agentInput.onProgress = runOptions.onProgress;
        runOptions.onProgress({
          type: "candidates",
          candidates: artifacts.candidates,
        });
      }
      const agentRun = await runBottleClassifierAgentWithBudget(agentInput);
      const agentResult = {
        ...agentRun.agentResult,
        // Extraction provenance is runtime-owned. Agent output cannot replace it.
        artifacts: buildBottleClassificationArtifacts({
          ...agentRun.agentResult.artifacts,
          extractedIdentitySource: artifacts.extractedIdentitySource,
        }),
      };
      options.observeReferenceAgentDecision?.(agentResult.decision);
      // Scope is the agent's judgment: anything that is not one whisky Bottle
      // is ignored, and callers stop tracking the source.
      if (agentResult.decision.action === "ignore") {
        return {
          result: BottleClassificationResultSchema.parse(
            createIgnoredReferenceClassification(
              agentResult.decision.rationale?.trim() ||
                "The classifier found that the source is not one whisky Bottle.",
              agentResult.artifacts,
            ),
          ),
          modelMetadata: agentRun.modelMetadata,
        };
      }
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
