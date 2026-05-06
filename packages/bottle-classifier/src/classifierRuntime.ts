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
  type EntityResolution,
  type ProposedRelease,
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
import {
  AUTHORITATIVE_SOURCE_TIERS,
  buildProducerIdentityPhrases,
  classifySourceTier,
  getSearchResultText,
  textsOverlap,
} from "./identityEvidenceCore";
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
  createBottleWebSearchBudget,
  createBraveWebSearchTool,
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
  runBottleWebEvidenceSearch,
} from "./tools";
import type { BottleWebSearchBudget } from "./tools/sharedWebSearch";

const CLASSIFIER_MAX_TURNS = 8;

type ReleaseSearchParts = Pick<
  ProposedRelease,
  | "edition"
  | "statedAge"
  | "abv"
  | "caskStrength"
  | "singleCask"
  | "vintageYear"
  | "releaseYear"
  | "caskType"
  | "caskSize"
  | "caskFill"
>;

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

function addReleaseSearchParts(
  parts: string[],
  release: ReleaseSearchParts | null | undefined,
) {
  if (!release) {
    return;
  }

  addSearchPart(parts, release.edition);
  if (release.statedAge !== null) {
    addSearchPart(parts, `${release.statedAge} year old`);
  }
  if (release.abv !== null) {
    addSearchPart(parts, `${release.abv}% ABV`);
  }
  if (release.caskStrength) {
    addSearchPart(parts, "cask strength");
  }
  if (release.singleCask) {
    addSearchPart(parts, "single cask");
  }
  if (release.vintageYear !== null) {
    addSearchPart(parts, `${release.vintageYear} vintage`);
  }
  if (release.releaseYear !== null) {
    addSearchPart(parts, `${release.releaseYear} release`);
  }
  addSearchPart(parts, release.caskType?.replace(/_/g, " "));
  addSearchPart(parts, release.caskSize?.replace(/_/g, " "));
  addSearchPart(parts, release.caskFill?.replace(/_/g, " "));
}

function getCreateDecisionParentCandidate({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleCandidate | null {
  if (decision.action !== "create_release") {
    return null;
  }

  return (
    artifacts.candidates.find(
      (candidate) =>
        candidate.bottleId === decision.parentBottleId &&
        candidate.releaseId === null &&
        candidate.kind !== "release",
    ) ?? null
  );
}

function getCreateDecisionBottleName({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): string | null {
  if (decision.proposedBottle) {
    return [
      decision.proposedBottle.brand.name,
      decision.proposedBottle.series?.name,
      decision.proposedBottle.name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const parentCandidate = getCreateDecisionParentCandidate({
    decision,
    artifacts,
  });
  return parentCandidate?.bottleFullName ?? parentCandidate?.fullName ?? null;
}

function buildCreateDecisionEvidencePhrases({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): string[] {
  const phrases: string[] = [];
  addSearchPart(
    phrases,
    getCreateDecisionBottleName({
      decision,
      artifacts,
    }),
  );

  if (decision.proposedBottle) {
    addSearchPart(phrases, decision.proposedBottle.name);
    addSearchPart(phrases, decision.proposedBottle.series?.name);
  }

  addSearchPart(phrases, decision.proposedRelease?.edition);
  addSearchPart(phrases, decision.observation?.caskNumber);
  addSearchPart(phrases, decision.observation?.barrelNumber);

  return phrases.filter((phrase) => phrase.length >= 4);
}

function buildCreateDecisionEvidenceQuery({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): string | null {
  if (
    decision.action !== "create_bottle" &&
    decision.action !== "create_release" &&
    decision.action !== "create_bottle_and_release"
  ) {
    return null;
  }

  const parts: string[] = [];
  addSearchPart(
    parts,
    getCreateDecisionBottleName({
      decision,
      artifacts,
    }),
  );

  if (decision.proposedBottle) {
    addSearchPart(parts, decision.proposedBottle.bottler?.name);
    for (const distiller of decision.proposedBottle.distillers) {
      addSearchPart(parts, distiller.name);
    }
    addSearchPart(parts, decision.proposedBottle.category?.replace(/_/g, " "));
    addReleaseSearchParts(parts, decision.proposedBottle);
  }

  addReleaseSearchParts(parts, decision.proposedRelease);
  addSearchPart(parts, decision.observation?.caskNumber);
  addSearchPart(parts, decision.observation?.barrelNumber);

  if (!parts.length) {
    addSearchPart(parts, reference.name);
  }

  return parts.length ? parts.join(" ") : null;
}

function hasAuthoritativeSearchEvidenceForDecision({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  const targetCandidate = getCreateDecisionParentCandidate({
    decision,
    artifacts,
  });
  const producerPhrases = buildProducerIdentityPhrases({
    proposedBottle: decision.proposedBottle,
    extractedLabel: artifacts.extractedIdentity,
    targetCandidate,
  });
  const evidencePhrases = buildCreateDecisionEvidencePhrases({
    decision,
    artifacts,
  });
  if (!evidencePhrases.length) {
    return false;
  }

  return artifacts.searchEvidence.some((evidence) =>
    evidence.results.some((result) => {
      const sourceTier = classifySourceTier({
        result,
        sourceUrl: reference.url ?? "",
        producerPhrases,
      });
      if (!AUTHORITATIVE_SOURCE_TIERS.has(sourceTier)) {
        return false;
      }

      const resultText = getSearchResultText(evidence, result);
      return evidencePhrases.some((phrase) => textsOverlap(resultText, phrase));
    }),
  );
}

async function maybeBackfillCreateDecisionSearchEvidence({
  options,
  reference,
  decision,
  artifacts,
  candidateExpansion,
  webSearchBudget,
}: {
  options: CreateBottleClassifierOptions;
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
  candidateExpansion: CandidateExpansionMode;
  webSearchBudget?: BottleWebSearchBudget;
}): Promise<BottleClassificationArtifacts> {
  if (
    candidateExpansion !== "open" ||
    options.maxSearchQueries <= 0 ||
    !hasUsableOpenAIResponsesClient(options.client) ||
    (decision.action !== "create_bottle" &&
      decision.action !== "create_release" &&
      decision.action !== "create_bottle_and_release") ||
    hasAuthoritativeSearchEvidenceForDecision({
      reference,
      decision,
      artifacts,
    })
  ) {
    return artifacts;
  }

  const query = buildCreateDecisionEvidenceQuery({
    reference,
    decision,
    artifacts,
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

  if (!("error" in result) && result.results.length > 0) {
    mergeSearchEvidence(searchEvidence, result);
  }

  if (searchEvidence.length === artifacts.searchEvidence.length) {
    return artifacts;
  }

  return buildBottleClassificationArtifacts({
    ...artifacts,
    searchEvidence,
  });
}

export async function finalizeBottleClassifierReasoningResult({
  options,
  reference,
  reasoning,
  candidateExpansion,
  webSearchBudget,
}: {
  options: CreateBottleClassifierOptions;
  reference: BottleReference;
  reasoning: BottleClassifierReasoningResult;
  candidateExpansion?: CandidateExpansionMode;
  webSearchBudget?: BottleWebSearchBudget;
}): Promise<{
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}> {
  let artifacts = reasoning.artifacts;
  const normalizedCandidateExpansion = candidateExpansion ?? "open";
  // Normalize once without the creation-evidence guard so runtime web
  // backfill can run, then normalize again with the guard enabled.
  let decision = finalizeBottleReferenceClassification({
    reference,
    decision: reasoning.decision,
    artifacts,
    options: {
      enforceCreateWebEvidence: false,
    },
  });

  artifacts = await maybeBackfillCreateDecisionSearchEvidence({
    options,
    reference,
    decision,
    artifacts,
    candidateExpansion: normalizedCandidateExpansion,
    webSearchBudget,
  });
  decision = finalizeBottleReferenceClassification({
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
  }: RunBottleClassifierAgentInput): Promise<BottleClassifierReasoningRun> => {
    if (options.overrides?.runBottleClassifierAgent) {
      return {
        reasoning: await options.overrides.runBottleClassifierAgent({
          reference,
          extractedIdentity,
          initialCandidates,
          candidateExpansion,
        }),
      };
    }

    const preparedRun = await prepareBottleClassifierAgentRun(options, {
      reference,
      initialCandidates,
      extractedIdentity,
      candidateExpansion,
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

      const reasoningRun = await runBottleClassifierAgentWithBudget({
        reference: parsedInput.reference,
        extractedIdentity: artifacts.extractedIdentity,
        initialCandidates: artifacts.candidates,
        candidateExpansion: parsedInput.candidateExpansion,
      });
      const { decision, artifacts: reasoningArtifacts } =
        await finalizeBottleClassifierReasoningResult({
          options,
          reference: parsedInput.reference,
          reasoning: reasoningRun.reasoning,
          candidateExpansion: parsedInput.candidateExpansion,
          webSearchBudget: reasoningRun.webSearchBudget,
        });

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
