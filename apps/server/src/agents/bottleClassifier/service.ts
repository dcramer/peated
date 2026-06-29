import type {
  BottleReference,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
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
} from "@peated/server/lib/openaiClient";
import { absoluteUrl } from "@peated/server/lib/urls";

let bottleClassifier: ReturnType<typeof createBottleClassifier> | null = null;

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

export function getBottleClassifier() {
  if (bottleClassifier) {
    return bottleClassifier;
  }

  const client = createOpenAIClient();

  bottleClassifier = createBottleClassifier({
    client,
    model: config.OPENAI_MODEL,
    maxSearchQueries: config.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES,
    braveApiKey: config.BRAVE_API_KEY,
    adapters: {
      findInitialCandidates: async ({ reference, extractedIdentity }) =>
        await findBottleReferenceCandidates(
          {
            name: reference.name,
            bottleId: reference.currentBottleId ?? null,
            releaseId: reference.currentReleaseId ?? null,
          },
          extractedIdentity,
        ),
      searchBottles: searchBottleCandidates,
      getBottleCandidateById,
      searchEntities: searchBottleClassifierEntities,
    },
  });

  return bottleClassifier;
}

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId =
    reference.id === undefined || reference.id === null
      ? `bottle_classifier:${reference.name}`
      : `bottle_reference:${reference.id}`;

  return await withSentryConversation(conversationId, async () => {
    return await getBottleClassifier().classifyBottleReference({
      ...input,
      reference,
    });
  });
}

export async function runBottleClassifierAgent(
  input: RunBottleClassifierAgentInput,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId =
    reference.id === undefined || reference.id === null
      ? `bottle_classifier:${reference.name}`
      : `bottle_reference:${reference.id}`;

  return await withSentryConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleClassifierAgent({
      ...input,
      reference,
    });
  });
}
