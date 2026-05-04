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
  type BottleClassifierAgentDecision,
  type BottleExtractedDetails,
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
import { getDeterministicOpenAISettings } from "./openaiModelSettings";
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
  createBottleWebSearchBudget,
  createBraveWebSearchTool,
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
} from "./tools";

const CLASSIFIER_MAX_TURNS = 8;

export type BottleClassifierReasoningResult = {
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
};

export type RunBottleClassifierAgentInput = {
  reference: BottleReference;
  extractedIdentity?: BottleExtractedDetails | null;
  initialCandidates?: BottleCandidate[];
  candidateExpansion?: CandidateExpansionMode;
};

export type BottleClassifierAdapters = {
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

export type CreateBottleClassifierOptions = {
  client: OpenAI;
  model: string;
  maxSearchQueries: number;
  braveApiKey?: string | null;
  adapters: BottleClassifierAdapters;
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
  decision: BottleClassifierAgentDecision,
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
  }: RunBottleClassifierAgentInput,
): Promise<PreparedBottleClassifierAgentRun> {
  const state: BottleClassifierAgentRunState = {
    searchEvidence: [],
    candidateBottles: new Map<string, BottleCandidate>(),
    resolvedEntities: new Map<number, EntityResolution>(),
  };
  const normalizedExtractedIdentity = extractedIdentity ?? null;
  const hasExactAliasMatch = initialCandidates.some((candidate) =>
    candidate.source.includes("exact"),
  );

  for (const candidate of initialCandidates) {
    mergeBottleCandidate(state.candidateBottles, candidate);
  }

  const hydratedCurrentBottle = reference.currentBottleId
    ? options.adapters.getBottleCandidateById
      ? await options.adapters.getBottleCandidateById(
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
  const webSearchBudget = createBottleWebSearchBudget(options.maxSearchQueries);
  const instructions = buildBottleClassifierInstructions({
    maxSearchQueries: options.maxSearchQueries,
    hasBottleSearch: allowCandidateExpansion,
    hasOpenAIWebSearch: allowCandidateExpansion,
    hasBraveWebSearch: allowCandidateExpansion && !!options.braveApiKey,
    hasEntitySearch:
      allowCandidateExpansion && !!options.adapters.searchEntities,
  });

  const tools = allowCandidateExpansion
    ? [
        createSearchBottlesTool({
          searchBottles: options.adapters.searchBottles,
          onResults: (results) => {
            for (const candidate of results) {
              mergeBottleCandidate(state.candidateBottles, candidate);
            }
          },
        }),
        ...(options.adapters.searchEntities
          ? [
              createSearchEntitiesTool({
                searchEntities: options.adapters.searchEntities,
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
      ...getDeterministicOpenAISettings(options.model),
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
    getArtifacts,
    getReasoningResult: (result) => {
      mergeRunResultToolArtifacts(state, result);

      const finalOutput = getAgentFinalOutput(result);
      if (!finalOutput) {
        throw new Error("Agent returned empty output");
      }

      return {
        decision: parseAgentDecision(
          finalOutput as BottleClassifierAgentDecision,
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
    if (initialCandidates !== undefined) {
      return initialCandidates;
    }

    if (options.adapters.findInitialCandidates) {
      return await options.adapters.findInitialCandidates({
        reference,
        extractedIdentity,
      });
    }

    return await options.adapters.searchBottles(
      buildDefaultBottleSearchInput({
        reference,
        extractedIdentity,
      }),
    );
  };

  const runBottleClassifierAgent = async ({
    reference,
    extractedIdentity,
    initialCandidates = [],
    candidateExpansion = "open",
  }: RunBottleClassifierAgentInput): Promise<BottleClassifierReasoningResult> => {
    if (options.overrides?.runBottleClassifierAgent) {
      return await options.overrides.runBottleClassifierAgent({
        reference,
        extractedIdentity,
        initialCandidates,
        candidateExpansion,
      });
    }

    const preparedRun = await prepareBottleClassifierAgentRun(options, {
      reference,
      initialCandidates,
      extractedIdentity,
      candidateExpansion,
    });

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

  const classifyBottleReference = async (
    input: ClassifyBottleReferenceInput,
  ): Promise<BottleClassificationResult> => {
    const parsedInput = ClassifyBottleReferenceInputSchema.parse(input);
    let artifacts = buildBottleClassificationArtifacts({});

    try {
      const extractedIdentity =
        parsedInput.extractedIdentity !== undefined
          ? parsedInput.extractedIdentity
          : await extractBottleReferenceIdentity(parsedInput.reference);

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

      const reasoning = await runBottleClassifierAgent({
        reference: parsedInput.reference,
        extractedIdentity: artifacts.extractedIdentity,
        initialCandidates: artifacts.candidates,
        candidateExpansion: parsedInput.candidateExpansion,
      });
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
