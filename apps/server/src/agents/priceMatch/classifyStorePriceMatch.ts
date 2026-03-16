import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import { buildStorePriceMatchInstructions } from "@peated/server/agents/whisky/guidance";
import config from "@peated/server/config";
import { type StorePrice } from "@peated/server/db/schema";
import {
  getBottleMatchCandidateById,
  mergePriceMatchCandidate,
} from "@peated/server/lib/priceMatchingCandidates";
import type {
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  StorePriceMatchAgentDecisionSchema,
} from "@peated/server/schemas";
import {
  StorePriceMatchAgentResponseSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import OpenAI from "openai";
import type { z } from "zod";
import {
  createOpenAIWebSearchTool,
  createSearchBottlesTool,
  createSearchEntitiesTool,
  type EntitySearchResult,
} from "./tools";

const CLASSIFIER_MAX_TURNS = 8;

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type AgentDecision = z.infer<typeof StorePriceMatchAgentDecisionSchema>;

export type StorePriceMatchClassification = {
  decision: z.infer<typeof StorePriceMatchDecisionSchema>;
  searchEvidence: SearchEvidence[];
  candidateBottles: PriceMatchCandidate[];
  resolvedEntities: EntitySearchResult[];
};

function mergeCandidate(
  candidates: Map<string, PriceMatchCandidate>,
  candidate: PriceMatchCandidate,
) {
  mergePriceMatchCandidate(candidates, candidate);
}

function mergeResolvedEntity(
  entities: Map<number, EntitySearchResult>,
  entity: EntitySearchResult,
) {
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

function parseClassifierDecision(decision: AgentDecision) {
  return StorePriceMatchDecisionSchema.parse(decision);
}

export class StorePriceMatchClassificationError extends Error {
  constructor(
    message: string,
    readonly searchEvidence: SearchEvidence[],
    readonly candidateBottles: PriceMatchCandidate[],
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, options);
    this.name = "StorePriceMatchClassificationError";
  }
}

export async function classifyStorePriceMatch({
  price,
  extractedLabel,
  initialCandidates = [],
}: {
  price: StorePrice;
  extractedLabel: ExtractedBottleDetails | null;
  initialCandidates?: PriceMatchCandidate[];
}) {
  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });

  const searchEvidence: SearchEvidence[] = [];
  const candidateBottles = new Map<string, PriceMatchCandidate>();
  const resolvedEntities = new Map<number, EntitySearchResult>();
  const hasExactAliasMatch = initialCandidates.some((candidate) =>
    candidate.source.includes("exact"),
  );

  for (const candidate of initialCandidates) {
    mergeCandidate(candidateBottles, candidate);
  }

  const currentBottle = price.bottleId
    ? await getBottleMatchCandidateById(price.bottleId, price.releaseId ?? null)
    : null;
  if (currentBottle) {
    mergeCandidate(candidateBottles, currentBottle);
  }

  const instructions = buildStorePriceMatchInstructions({
    maxSearchQueries: config.PRICE_MATCH_MAX_SEARCH_QUERIES,
  });

  const agent = new Agent({
    name: "store_price_match_classifier",
    instructions,
    model: config.OPENAI_MODEL,
    modelSettings: {
      parallelToolCalls: false,
      temperature: 0,
    },
    outputType: StorePriceMatchAgentResponseSchema,
    tools: [
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
        maxQueries: config.PRICE_MATCH_MAX_SEARCH_QUERIES,
        onEvidence: (evidence) => {
          searchEvidence.push(evidence);
        },
      }),
    ],
  });

  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient: client,
      useResponses: true,
    }),
    workflowName: "Store Price Match",
    groupId: `store_price:${price.id}`,
    traceMetadata: {
      price_id: `${price.id}`,
      external_site_id: `${price.externalSiteId}`,
      current_bottle_id: price.bottleId ? `${price.bottleId}` : "none",
    },
  });

  const input = JSON.stringify(
    {
      price: {
        id: price.id,
        name: price.name,
        url: price.url,
        volume: price.volume,
        currentBottleId: price.bottleId,
        currentReleaseId: price.releaseId,
      },
      currentBottle,
      extractedLabel,
      localSearch: {
        hasExactAliasMatch,
        candidates: initialCandidates,
      },
    },
    null,
    2,
  );

  try {
    const result = await runner.run(agent, input, {
      maxTurns: CLASSIFIER_MAX_TURNS,
    });

    if (!result.finalOutput) {
      throw new Error("Agent returned empty output");
    }

    const { decision: agentDecision } =
      StorePriceMatchAgentResponseSchema.parse(result.finalOutput);
    const decision = parseClassifierDecision(agentDecision);

    return {
      decision,
      searchEvidence,
      candidateBottles: Array.from(candidateBottles.values()).sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0),
      ),
      resolvedEntities: Array.from(resolvedEntities.values()).sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0),
      ),
    };
  } catch (err) {
    throw new StorePriceMatchClassificationError(
      err instanceof Error ? err.message : "Unknown classifier error",
      searchEvidence,
      Array.from(candidateBottles.values()).sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0),
      ),
      { cause: err },
    );
  }
}
