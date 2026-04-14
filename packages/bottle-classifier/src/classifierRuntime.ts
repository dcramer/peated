import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import type OpenAI from "openai";
import { normalizePotentialProofLikeDecision } from "./abv";
import {
  finalizeBottleReferenceClassification,
  getAutoIgnoreBottleReferenceReason,
} from "./classificationPolicy";
import {
  BottleCandidateSearchInputSchema,
  BottleClassifierAgentDecisionSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleClassifierAgentDecision,
  type BottleExtractedDetails,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "./classifierSchemas";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  type BottleClassificationArtifacts,
  type BottleClassificationResult,
  type BottleReference,
  type ClassifyBottleReferenceInput,
} from "./contract";
import { BottleClassificationError } from "./error";
import { createWhiskyLabelExtractor } from "./extractor";
import { buildBottleClassifierInstructions } from "./instructions";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";
import {
  createBottleWebSearchBudget,
  createBraveWebSearchTool,
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
} from "./tools";

const CLASSIFIER_MAX_TURNS = 8;
const DEFAULT_MATCH_CANDIDATE_LIMIT = 15;

type BottleClassifierReasoningResult = {
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
};

export type RunBottleClassifierAgentInput = {
  reference: BottleReference;
  extractedIdentity?: BottleExtractedDetails | null;
  initialCandidates?: BottleCandidate[];
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

const CANDIDATE_METADATA_FIELDS = [
  "bottler",
  "series",
  "category",
  "statedAge",
  "edition",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
  "caskType",
  "caskSize",
  "caskFill",
] as const satisfies ReadonlyArray<keyof BottleCandidate>;

function getBottleCandidateKey(
  candidate: Pick<BottleCandidate, "bottleId" | "releaseId" | "kind">,
) {
  return candidate.releaseId !== null || candidate.kind === "release"
    ? `release:${candidate.releaseId ?? "missing"}`
    : `bottle:${candidate.bottleId}`;
}

function mergeBottleCandidate(
  candidates: Map<string, BottleCandidate>,
  candidate: BottleCandidate,
) {
  const key = getBottleCandidateKey(candidate);
  const existing = candidates.get(key);
  if (!existing) {
    candidates.set(key, candidate);
    return;
  }

  existing.source = Array.from(
    new Set([...existing.source, ...candidate.source]),
  );

  if (
    candidate.score !== null &&
    (existing.score === null || candidate.score > existing.score)
  ) {
    existing.score = candidate.score;
  }

  if (!existing.alias && candidate.alias) {
    existing.alias = candidate.alias;
  }

  if (!existing.series && candidate.series) {
    existing.series = candidate.series;
  }

  if (!existing.bottler && candidate.bottler) {
    existing.bottler = candidate.bottler;
  }

  if (!existing.distillery.length && candidate.distillery.length) {
    existing.distillery = candidate.distillery;
  } else if (candidate.distillery.length) {
    existing.distillery = Array.from(
      new Set([...existing.distillery, ...candidate.distillery]),
    );
  }

  const existingMetadata = existing as Record<
    (typeof CANDIDATE_METADATA_FIELDS)[number],
    BottleCandidate[(typeof CANDIDATE_METADATA_FIELDS)[number]]
  >;

  for (const field of CANDIDATE_METADATA_FIELDS) {
    const existingValue = existingMetadata[field];
    const candidateValue = candidate[field];

    if (existingValue === null && candidateValue !== null) {
      existingMetadata[field] = candidateValue;
    }
  }
}

function mergeResolvedEntity(
  entities: Map<number, EntityResolution>,
  entity: EntityResolution,
): void {
  const existing = entities.get(entity.entityId);
  if (!existing) {
    entities.set(entity.entityId, entity);
    return;
  }

  existing.source = Array.from(new Set([...existing.source, ...entity.source]));

  if (
    entity.score !== null &&
    (existing.score === null || entity.score > existing.score)
  ) {
    existing.score = entity.score;
  }

  if (!existing.alias && entity.alias) {
    existing.alias = entity.alias;
  }

  if (!existing.shortName && entity.shortName) {
    existing.shortName = entity.shortName;
  }
}

function parseAgentDecision(
  decision: BottleClassifierAgentDecision,
): BottleClassifierAgentDecision {
  return BottleClassifierAgentDecisionSchema.parse(
    normalizePotentialProofLikeDecision(decision),
  );
}

function buildAgentInput({
  reference,
  extractedIdentity,
  initialCandidates,
  currentBottle,
  hasExactAliasMatch,
}: {
  reference: BottleReference;
  extractedIdentity: BottleExtractedDetails | null;
  initialCandidates: BottleCandidate[];
  currentBottle: BottleCandidate | null;
  hasExactAliasMatch: boolean;
}): string {
  return JSON.stringify(
    {
      reference: {
        id: reference.id ?? null,
        name: reference.name,
        url: reference.url ?? null,
        imageUrl: reference.imageUrl ?? null,
        currentBottleId: reference.currentBottleId ?? null,
        currentReleaseId: reference.currentReleaseId ?? null,
      },
      currentBottle,
      extractedIdentity,
      localSearch: {
        hasExactAliasMatch,
        candidates: initialCandidates,
      },
    },
    null,
    2,
  );
}

function buildDefaultBottleSearchInput({
  reference,
  extractedIdentity,
}: {
  reference: BottleReference;
  extractedIdentity: BottleExtractedDetails | null;
}): BottleCandidateSearchInput {
  return BottleCandidateSearchInputSchema.parse({
    query: reference.name,
    brand: extractedIdentity?.brand ?? null,
    bottler: extractedIdentity?.bottler ?? null,
    expression: extractedIdentity?.expression ?? null,
    series: extractedIdentity?.series ?? null,
    distillery: extractedIdentity?.distillery ?? [],
    category: extractedIdentity?.category ?? null,
    stated_age: extractedIdentity?.stated_age ?? null,
    abv: extractedIdentity?.abv ?? null,
    cask_type: extractedIdentity?.cask_type ?? null,
    cask_size: extractedIdentity?.cask_size ?? null,
    cask_fill: extractedIdentity?.cask_fill ?? null,
    cask_strength: extractedIdentity?.cask_strength ?? null,
    single_cask: extractedIdentity?.single_cask ?? null,
    edition: extractedIdentity?.edition ?? null,
    vintage_year: extractedIdentity?.vintage_year ?? null,
    release_year: extractedIdentity?.release_year ?? null,
    currentBottleId: reference.currentBottleId ?? null,
    currentReleaseId: reference.currentReleaseId ?? null,
    limit: DEFAULT_MATCH_CANDIDATE_LIMIT,
  });
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
  }: RunBottleClassifierAgentInput): Promise<BottleClassifierReasoningResult> => {
    if (options.overrides?.runBottleClassifierAgent) {
      return await options.overrides.runBottleClassifierAgent({
        reference,
        extractedIdentity,
        initialCandidates,
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

    const currentBottle = reference.currentBottleId
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
    if (currentBottle) {
      mergeBottleCandidate(candidateBottles, currentBottle);
    }

    const webSearchBudget = createBottleWebSearchBudget(
      options.maxSearchQueries,
    );
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: options.maxSearchQueries,
      hasBraveWebSearch: !!options.braveApiKey,
      hasEntitySearch: !!options.adapters.searchEntities,
    });

    const tools = [
      createSearchBottlesTool({
        searchBottles: options.adapters.searchBottles,
        onResults: (results) => {
          for (const candidate of results) {
            mergeBottleCandidate(candidateBottles, candidate);
          }
        },
      }),
      createOpenAIWebSearchTool({
        client: options.client,
        model: options.model,
        budget: webSearchBudget,
        braveApiKey: options.braveApiKey,
        onEvidence: (evidence) => {
          searchEvidence.push(evidence);
        },
      }),
    ];

    if (options.adapters.searchEntities) {
      tools.splice(
        1,
        0,
        createSearchEntitiesTool({
          searchEntities: options.adapters.searchEntities,
          onResults: (results) => {
            for (const result of results) {
              mergeResolvedEntity(resolvedEntities, result);
            }
          },
        }),
      );
    }

    if (options.braveApiKey) {
      tools.push(
        createBraveWebSearchTool({
          apiKey: options.braveApiKey,
          budget: webSearchBudget,
          onEvidence: (evidence) => {
            searchEvidence.push(evidence);
          },
        }),
      );
    }

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
