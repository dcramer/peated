import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import type OpenAI from "openai";
import { normalizePotentialProofLikeDecision } from "./abv";
import {
  BottleClassifierAgentDecisionSchema,
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
import type { BottleWebSearchExecutionCache } from "./tools/sharedWebSearch";

const CLASSIFIER_MAX_TURNS = 8;

type BottleClassifierReasoningResult = {
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
    webSearchCache?: BottleWebSearchExecutionCache;
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

    const searchEvidence: BottleClassificationArtifacts["searchEvidence"] = [];
    const candidateBottles = new Map<string, BottleCandidate>();
    const resolvedEntities = new Map<number, EntityResolution>();
    const hasExactAliasMatch = initialCandidates.some((candidate) =>
      candidate.source.includes("exact"),
    );

    for (const candidate of initialCandidates) {
      mergeBottleCandidate(candidateBottles, candidate);
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
      mergeBottleCandidate(candidateBottles, currentBottle);
    }

    const allowCandidateExpansion = candidateExpansion === "open";
    const webSearchBudget = createBottleWebSearchBudget(
      options.maxSearchQueries,
    );
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
                mergeBottleCandidate(candidateBottles, candidate);
              }
            },
          }),
          ...(options.adapters.searchEntities
            ? [
                createSearchEntitiesTool({
                  searchEntities: options.adapters.searchEntities,
                  onResults: (results) => {
                    for (const result of results) {
                      mergeResolvedEntity(resolvedEntities, result);
                    }
                  },
                }),
              ]
            : []),
          createOpenAIWebSearchTool({
            client: options.client,
            model: options.model,
            budget: webSearchBudget,
            cache: options.overrides?.webSearchCache,
            onEvidence: (evidence) => {
              searchEvidence.push(evidence);
            },
          }),
          ...(options.braveApiKey
            ? [
                createBraveWebSearchTool({
                  apiKey: options.braveApiKey,
                  budget: webSearchBudget,
                  cache: options.overrides?.webSearchCache,
                  onEvidence: (evidence) => {
                    searchEvidence.push(evidence);
                  },
                }),
              ]
            : []),
        ]
      : [];

    const agent = new Agent({
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
      extractedIdentity: extractedIdentity ?? null,
      initialCandidates,
      currentBottle,
      hasExactAliasMatch,
      candidateExpansion,
    });

    try {
      const result = await runner.run(agent, input, {
        maxTurns: CLASSIFIER_MAX_TURNS,
      });
      if (!result.finalOutput) {
        throw new Error("Agent returned empty output");
      }

      return {
        decision: parseAgentDecision(
          result.finalOutput as BottleClassifierAgentDecision,
        ),
        artifacts: buildBottleClassificationArtifacts({
          extractedIdentity: extractedIdentity ?? null,
          searchEvidence,
          candidates: Array.from(candidateBottles.values()).sort(
            (left, right) => (right.score ?? 0) - (left.score ?? 0),
          ),
          resolvedEntities: Array.from(resolvedEntities.values()).sort(
            (left, right) => (right.score ?? 0) - (left.score ?? 0),
          ),
        }),
      };
    } catch (error) {
      throw new BottleClassificationError(
        error instanceof Error ? error.message : "Unknown classifier error",
        {
          extractedIdentity: extractedIdentity ?? null,
          searchEvidence,
          candidates: Array.from(candidateBottles.values()).sort(
            (left, right) => (right.score ?? 0) - (left.score ?? 0),
          ),
          resolvedEntities: Array.from(resolvedEntities.values()).sort(
            (left, right) => (right.score ?? 0) - (left.score ?? 0),
          ),
        },
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
