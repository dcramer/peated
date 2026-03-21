import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import { buildBottleClassifierInstructions } from "@peated/server/agents/whisky/guidance";
import config from "@peated/server/config";
import { normalizePotentialProofLikeDecision } from "@peated/server/lib/abv";
import {
  getBottleCandidateById,
  mergeBottleCandidate,
} from "@peated/server/lib/bottleReferenceCandidates";
import OpenAI from "openai";
import {
  buildBottleClassificationArtifacts,
  type BottleClassificationArtifacts,
  type BottleReference,
} from "./contract";
import {
  BottleClassifierAgentResponseSchema,
  BottleMatchDecisionSchema,
  type BottleCandidate,
  type BottleClassifierAgentDecision,
  type BottleExtractedDetails,
  type BottleMatchDecision,
  type EntityResolution,
} from "./schemas";
import {
  createBottleWebSearchBudget,
  createBraveWebSearchTool,
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
} from "./tools";

const CLASSIFIER_MAX_TURNS = 8;

type BottleClassifierReasoningResult = {
  decision: BottleMatchDecision;
  artifacts: BottleClassificationArtifacts;
};

type RunBottleClassifierAgentInput = {
  reference: BottleReference;
  extractedIdentity?: BottleExtractedDetails | null;
  initialCandidates?: BottleCandidate[];
};

function mergeCandidate(
  candidates: Map<string, BottleCandidate>,
  candidate: BottleCandidate,
): void {
  mergeBottleCandidate(candidates, candidate);
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
): BottleMatchDecision {
  return BottleMatchDecisionSchema.parse(
    normalizePotentialProofLikeDecision(decision),
  );
}

function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });
}

export class BottleClassificationError extends Error {
  readonly artifacts: BottleClassificationArtifacts;

  constructor(
    message: string,
    artifacts: Partial<BottleClassificationArtifacts>,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, options);
    this.name = "BottleClassificationError";
    this.artifacts = buildBottleClassificationArtifacts(artifacts);
  }
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

export async function runBottleClassifierAgent({
  reference,
  extractedIdentity,
  initialCandidates = [],
}: RunBottleClassifierAgentInput): Promise<BottleClassifierReasoningResult> {
  const client = createOpenAIClient();
  const searchEvidence: BottleClassificationArtifacts["searchEvidence"] = [];
  const candidateBottles = new Map<string, BottleCandidate>();
  const resolvedEntities = new Map<number, EntityResolution>();
  const hasExactAliasMatch = initialCandidates.some((candidate) =>
    candidate.source.includes("exact"),
  );

  for (const candidate of initialCandidates) {
    mergeCandidate(candidateBottles, candidate);
  }

  const currentBottle = reference.currentBottleId
    ? await getBottleCandidateById(
        reference.currentBottleId,
        reference.currentReleaseId ?? null,
      )
    : null;
  if (currentBottle) {
    mergeCandidate(candidateBottles, currentBottle);
  }

  const webSearchBudget = createBottleWebSearchBudget(
    config.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES,
  );
  const instructions = buildBottleClassifierInstructions({
    maxSearchQueries: config.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES,
    hasBraveWebSearch: !!config.BRAVE_API_KEY,
  });

  const tools = [
    createSearchBottlesTool({
      onResults: (results) => {
        for (const candidate of results) {
          mergeCandidate(candidateBottles, candidate);
        }
      },
    }),
    createSearchEntitiesTool({
      onResults: (results) => {
        for (const result of results) {
          mergeResolvedEntity(resolvedEntities, result);
        }
      },
    }),
    createOpenAIWebSearchTool({
      client,
      budget: webSearchBudget,
      braveApiKey: config.BRAVE_API_KEY,
      onEvidence: (evidence) => {
        searchEvidence.push(evidence);
      },
    }),
  ];

  if (config.BRAVE_API_KEY) {
    tools.push(
      createBraveWebSearchTool({
        apiKey: config.BRAVE_API_KEY,
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
    model: config.OPENAI_MODEL,
    modelSettings: {
      parallelToolCalls: false,
      temperature: 0,
    },
    outputType: BottleClassifierAgentResponseSchema,
    tools,
  });
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient: client,
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

    const { decision: agentDecision } =
      BottleClassifierAgentResponseSchema.parse(result.finalOutput);

    return {
      decision: parseAgentDecision(agentDecision),
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
}
