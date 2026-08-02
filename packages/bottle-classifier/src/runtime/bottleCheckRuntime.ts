import type { Runner } from "@openai/agents";
import type OpenAI from "openai";
import {
  BottleContextSchema,
  EntityContextSchema,
  type BottleContext,
  type BottleContextSource,
  type EntityContext,
} from "../bottleContextContract";
import {
  BottleCandidateSchema,
  BottleSearchEvidenceSchema,
  EntityResolutionSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleExtractedDetails,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";
import {
  buildBottleClassificationArtifacts,
  type BottleClassificationArtifacts,
  type BottleReference,
  type Finding,
} from "../contract";
import type { ImageBottleEvidence } from "../imageEvidence";
import type { OpenAIReasoningEffort } from "../openaiModelSettings";
import type {
  BottleProposalCollector,
  BottleWebSearchExecutor,
} from "../tools";
import {
  createBottleProposalCollector,
  createBottleProposalTools,
  createFirecrawlWebSearchTool,
  createGetBottleContextTool,
  createGetEntityContextTool,
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
} from "../tools";
import type { BottleWebSearchBudget } from "../tools/sharedWebSearch";
import {
  bottleContextToCandidate,
  createBottleContextLoader,
} from "./bottleCheckContext";
import { mergeBottleCandidate, mergeResolvedEntity } from "./candidates";

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
  ) => Promise<BottleCandidate | null>;
  getBottleContext?: (bottleId: number) => Promise<BottleContextSource | null>;
  getEntityContext?: (entityId: number) => Promise<EntityContext | null>;
  searchEntities?: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
};

export type BottleClassifierToolEvent =
  | {
      type: "tool_call";
      phase: "agent" | "preload";
      id: string;
      name: string;
      arguments: unknown;
    }
  | {
      type: "tool_result";
      phase: "agent" | "preload";
      toolCallId: string;
      name: string;
      result: unknown;
    };

type BottleClassifierToolObserver = (event: BottleClassifierToolEvent) => void;

type BottleCheckRuntimeOptions = {
  client: OpenAI;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageExtractionModel?: string;
  imageExtractionReasoningEffort?: OpenAIReasoningEffort;
  firecrawlApiKey?: string | null;
  firecrawlApiUrl?: string | null;
  executeWebSearch?: BottleWebSearchExecutor;
  overrides?: {
    extractFromImage?: (
      imageUrlOrBase64: string,
    ) => Promise<BottleExtractedDetails | null>;
  };
};

export type BottleClassifierAgentRunState = {
  candidateBottles: Map<number, BottleCandidate>;
  resolvedEntities: Map<number, EntityResolution>;
  searchEvidence: BottleClassificationArtifacts["searchEvidence"];
  bottleContexts: Map<number, BottleContext>;
  entityContexts: Map<number, EntityContext>;
};

export function mergeSearchEvidence(
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

export function sortedBottleCandidates(
  candidateBottles: Map<number, BottleCandidate>,
) {
  return Array.from(candidateBottles.values()).sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  );
}

export function sortedResolvedEntities(
  resolvedEntities: Map<number, EntityResolution>,
) {
  return Array.from(resolvedEntities.values()).sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  );
}

export function buildAgentArtifacts({
  extractedIdentity,
  imageEvidence,
  state,
}: {
  extractedIdentity: BottleExtractedDetails | null;
  imageEvidence: ImageBottleEvidence | null;
  state: BottleClassifierAgentRunState;
}) {
  return buildBottleClassificationArtifacts({
    extractedIdentity,
    imageEvidence,
    searchEvidence: state.searchEvidence,
    candidates: sortedBottleCandidates(state.candidateBottles),
    resolvedEntities: sortedResolvedEntities(state.resolvedEntities),
    bottleContexts: Array.from(state.bottleContexts.values()).sort(
      (left, right) => left.bottleId - right.bottleId,
    ),
    entityContexts: Array.from(state.entityContexts.values()).sort(
      (left, right) => left.entityId - right.entityId,
    ),
  });
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

export function observeRunnerTools(
  runner: Runner,
  observer: BottleClassifierToolObserver | undefined,
) {
  if (!observer) {
    return;
  }

  runner.on("agent_tool_start", (_context, _agent, tool, { toolCall }) => {
    const callId =
      stringProperty(toolCall, "callId") ?? stringProperty(toolCall, "id");
    if (!callId) {
      return;
    }

    observer({
      type: "tool_call",
      phase: "agent",
      id: callId,
      name: tool.name,
      arguments: normalizeToolOutputValue(
        stringProperty(toolCall, "arguments"),
      ),
    });
  });
  runner.on(
    "agent_tool_end",
    (_context, _agent, tool, result, { toolCall }) => {
      const callId =
        stringProperty(toolCall, "callId") ?? stringProperty(toolCall, "id");
      if (!callId) {
        return;
      }

      observer({
        type: "tool_result",
        phase: "agent",
        toolCallId: callId,
        name: tool.name,
        result: normalizeToolOutputValue(result),
      });
    },
  );
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

  if (toolName === "get_bottle_context") {
    const parsedContext = BottleContextSchema.nullable().safeParse(
      getObjectProperty(normalizedOutput, "context"),
    );
    if (parsedContext.success && parsedContext.data) {
      state.bottleContexts.set(parsedContext.data.bottleId, parsedContext.data);
      mergeBottleCandidate(
        state.candidateBottles,
        bottleContextToCandidate(parsedContext.data),
      );
    }
    return;
  }

  if (toolName === "get_entity_context") {
    const parsedContext = EntityContextSchema.nullable().safeParse(
      getObjectProperty(normalizedOutput, "context"),
    );
    if (parsedContext.success && parsedContext.data) {
      state.entityContexts.set(parsedContext.data.entityId, parsedContext.data);
    }
    return;
  }

  if (toolName === "openai_web_search" || toolName === "firecrawl_web_search") {
    const evidence = BottleSearchEvidenceSchema.safeParse(normalizedOutput);
    if (evidence.success) {
      mergeSearchEvidence(state.searchEvidence, evidence.data);
    }
  }
}

export function mergeRunResultToolArtifacts(
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

export function getAgentFinalOutput(result: unknown) {
  return getObjectProperty(result, "finalOutput");
}

export function createBottleCheckTools({
  allowCandidateExpansion,
  dataSource,
  options,
  proposalCollector,
  state,
  webSearchBudget,
}: {
  allowCandidateExpansion: boolean;
  dataSource: BottleClassifierDataSource;
  options: BottleCheckRuntimeOptions;
  proposalCollector: BottleProposalCollector | null;
  state: BottleClassifierAgentRunState;
  webSearchBudget: BottleWebSearchBudget;
}) {
  const proposalTools = proposalCollector
    ? createBottleProposalTools(proposalCollector)
    : [];
  const allowContextInspection = proposalCollector !== null;
  const useFirecrawlWebSearch =
    allowCandidateExpansion && !!options.firecrawlApiKey;
  const loadBottleContext = allowContextInspection
    ? createBottleContextLoader({
        dataSource,
        options,
      })
    : null;
  return [
    ...(allowCandidateExpansion
      ? [
          createSearchBottlesTool({
            searchBottles: dataSource.searchBottles,
            onResults: (results) => {
              for (const candidate of results) {
                mergeBottleCandidate(state.candidateBottles, candidate);
              }
            },
          }),
        ]
      : []),
    ...(allowCandidateExpansion && dataSource.searchEntities
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
    ...(loadBottleContext
      ? [
          createGetBottleContextTool({
            getBottleContext: async (bottleId) =>
              state.bottleContexts.get(bottleId) ??
              (await loadBottleContext(bottleId)),
            onContext: (context) => {
              state.bottleContexts.set(context.bottleId, context);
              mergeBottleCandidate(
                state.candidateBottles,
                bottleContextToCandidate(context),
              );
            },
          }),
        ]
      : []),
    ...(allowContextInspection && dataSource.getEntityContext
      ? [
          createGetEntityContextTool({
            getEntityContext: dataSource.getEntityContext,
            onContext: (context) => {
              state.entityContexts.set(context.entityId, context);
            },
          }),
        ]
      : []),
    ...(allowCandidateExpansion && options.firecrawlApiKey
      ? [
          createFirecrawlWebSearchTool({
            apiKey: options.firecrawlApiKey,
            apiUrl: options.firecrawlApiUrl ?? undefined,
            budget: webSearchBudget,
            executeWebSearch: options.executeWebSearch,
            onEvidence: (evidence) => {
              mergeSearchEvidence(state.searchEvidence, evidence);
            },
          }),
        ]
      : []),
    ...(allowCandidateExpansion && !useFirecrawlWebSearch
      ? [
          createOpenAIWebSearchTool({
            client: options.client,
            model: options.model,
            reasoningEffort: options.reasoningEffort,
            budget: webSearchBudget,
            executeWebSearch: options.executeWebSearch,
            onEvidence: (evidence) => {
              mergeSearchEvidence(state.searchEvidence, evidence);
            },
          }),
        ]
      : []),
    ...proposalTools,
  ];
}

export function createRunProposalCollector({
  maxProposals,
  sourceFields,
  state,
}: {
  maxProposals: number;
  sourceFields: readonly string[];
  state: BottleClassifierAgentRunState;
}) {
  const sourceFieldSet = new Set(sourceFields);
  return createBottleProposalCollector({
    maxProposals,
    context: {
      hasBottleEvidence: (bottleId) => {
        if (
          state.candidateBottles.has(bottleId) ||
          state.bottleContexts.has(bottleId)
        ) {
          return true;
        }
        for (const candidate of state.candidateBottles.values()) {
          if (
            candidate.familyContext?.siblingBottles.some(
              (sibling) => sibling.bottleId === bottleId,
            )
          ) {
            return true;
          }
        }
        for (const context of state.bottleContexts.values()) {
          if (
            context.siblings.some((sibling) => sibling.bottleId === bottleId)
          ) {
            return true;
          }
        }
        return Array.from(state.entityContexts.values()).some((context) =>
          context.relatedBottles.some((bottle) => bottle.bottleId === bottleId),
        );
      },
      hasEntityEvidence: (entityId) => {
        if (
          state.resolvedEntities.has(entityId) ||
          state.entityContexts.has(entityId)
        ) {
          return true;
        }
        return Array.from(state.bottleContexts.values()).some(
          (context) =>
            context.shared.brand.entityId === entityId ||
            context.shared.distillers.some(
              (distiller) => distiller.entityId === entityId,
            ) ||
            context.shared.bottler?.entityId === entityId,
        );
      },
      hasSourceEvidence: (field) => sourceFieldSet.has(field),
      hasWebEvidence: (url) =>
        state.searchEvidence.some((evidence) =>
          evidence.results.some((result) => result.url === url),
        ),
      isBottleInspected: (bottleId) => state.bottleContexts.has(bottleId),
      isEntityInspected: (entityId) => state.entityContexts.has(entityId),
      isSeriesInspected: (seriesId) =>
        Array.from(state.bottleContexts.values()).some(
          (context) => context.shared.series?.seriesId === seriesId,
        ),
    },
  });
}

export function assertFindingsUseCollectedEvidence(
  findings: readonly Finding[],
  proposalCollector: BottleProposalCollector,
) {
  for (const [findingIndex, finding] of findings.entries()) {
    const missingEvidence = proposalCollector.getMissingEvidence(
      finding.evidenceRefs,
    );
    if (missingEvidence) {
      throw new Error(
        `Finding ${findingIndex} cites evidence that was not collected: ${JSON.stringify(missingEvidence)}.`,
      );
    }
    const uninspectedEvidence = proposalCollector.getUninspectedEvidence(
      finding.evidenceRefs,
    );
    if (uninspectedEvidence) {
      throw new Error(
        `Finding ${findingIndex} cites Bottle or Entity evidence that was not inspected: ${JSON.stringify(uninspectedEvidence)}.`,
      );
    }
  }
}
