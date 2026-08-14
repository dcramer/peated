import type {
  AuditBottleInput,
  BottleReference,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import { AuditBottleInputSchema } from "@peated/bottle-classifier/contract";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/internal/runtime";
import { createBottleClassifier } from "@peated/bottle-classifier/internal/runtime";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type SearchEntitiesArgs,
} from "@peated/bottle-classifier/internal/types";
import config from "@peated/server/config";
import {
  findBottleReferenceCandidates,
  getBottleCandidateById,
  searchBottleCandidates,
} from "@peated/server/lib/bottleReferenceCandidates";
import { searchClassifierEntities } from "@peated/server/lib/classifierEntitySearch";
import {
  createOpenAIClient,
  withSentryConversation,
  type AIGatewayWorkload,
} from "@peated/server/lib/openaiClient";
import { absoluteUrl } from "@peated/server/lib/urls";
import { randomUUID } from "node:crypto";
import {
  getBottleClassifierContext,
  getBottleClassifierImageInput,
  getEntityClassifierContext,
} from "./contextAdapters";

const bottleClassifiers: Partial<
  Record<AIGatewayWorkload, ReturnType<typeof createBottleClassifier>>
> = {};

async function searchBottleClassifierEntities(args: SearchEntitiesArgs) {
  const parsedArgs = SearchEntitiesArgsSchema.parse(args);
  return (await searchClassifierEntities(parsedArgs)).map((result) =>
    EntityResolutionSchema.parse(result),
  );
}

function normalizeReferenceForClassifier(
  reference: BottleReference,
): BottleReference {
  if (!reference.imageUrl) {
    return reference;
  }

  return {
    ...reference,
    imageUrl: absoluteUrl(config.API_SERVER, reference.imageUrl),
  };
}

function buildReferenceConversationId(
  prefix: string,
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

  return `${prefix}:${id}`;
}

async function withReferenceConversation<T>(
  conversationId: string,
  callback: () => Promise<T>,
) {
  return await withSentryConversation(conversationId, callback);
}

export function getBottleClassifier(
  workload: AIGatewayWorkload = "application",
) {
  const existingClassifier = bottleClassifiers[workload];
  if (existingClassifier) {
    return existingClassifier;
  }

  const client = createOpenAIClient({ workload });

  const bottleClassifier = createBottleClassifier({
    client,
    model: config.BOTTLE_CLASSIFIER_MODEL,
    reasoningEffort: config.BOTTLE_CLASSIFIER_REASONING_EFFORT,
    imageExtractionModel: config.OPENAI_IMAGE_EXTRACTION_MODEL,
    imageExtractionReasoningEffort:
      config.OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
    maxSearchQueries: config.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES,
    firecrawlApiKey:
      workload === "scraper"
        ? (config.SCRAPER_FIRECRAWL_API_KEY ?? config.FIRECRAWL_API_KEY)
        : config.FIRECRAWL_API_KEY,
    firecrawlApiUrl: config.FIRECRAWL_API_URL,
    adapters: {
      findInitialCandidates: async ({ reference, extractedIdentity }) =>
        await findBottleReferenceCandidates(
          {
            name: reference.name,
            bottleId: reference.currentBottleId ?? null,
          },
          extractedIdentity,
          { workload },
        ),
      searchBottles: async (input) =>
        await searchBottleCandidates(input, { workload }),
      getBottleCandidateById,
      getBottleContext: getBottleClassifierContext,
      getBottleContextImageInput: getBottleClassifierImageInput,
      getEntityContext: getEntityClassifierContext,
      searchEntities: searchBottleClassifierEntities,
    },
  });

  bottleClassifiers[workload] = bottleClassifier;
  return bottleClassifier;
}

async function runBottleReferenceForWorkload(
  input: ClassifyBottleReferenceInput,
  workload: AIGatewayWorkload,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId = buildReferenceConversationId(
    "bottle_reference",
    reference,
    input.conversationId,
  );

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier(workload).runBottleReference({
      ...input,
      reference,
      conversationId,
    });
  });
}

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return (await runBottleReference(input)).result;
}

export async function runBottleReference(input: ClassifyBottleReferenceInput) {
  return await runBottleReferenceForWorkload(input, "application");
}

export async function runScrapedBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return await runBottleReferenceForWorkload(input, "scraper");
}

export async function classifyScrapedBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return (await runScrapedBottleReference(input)).result;
}

export async function runBottleAudit(input: AuditBottleInput) {
  const parsedInput = AuditBottleInputSchema.parse(input);
  const conversationId = `bottle_audit:${parsedInput.bottleId}`;

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleAudit(parsedInput);
  });
}

export async function runBottleClassifierAgent(
  input: RunBottleClassifierAgentInput,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId = buildReferenceConversationId(
    "bottle_reference",
    reference,
    input.conversationId,
  );

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleClassifierAgent({
      ...input,
      reference,
      conversationId,
    });
  });
}
