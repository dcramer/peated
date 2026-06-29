import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  createEntityClassifier,
  type ClassifyEntityInput,
  type RunEntityClassifierAgentInput,
  type SearchEntitiesArgs,
} from "@peated/entity-classifier";
import config from "@peated/server/config";
import { searchClassifierEntities } from "@peated/server/lib/classifierEntitySearch";
import {
  createOpenAIClient,
  withSentryConversation,
} from "@peated/server/lib/openaiClient";

let entityClassifier: ReturnType<typeof createEntityClassifier> | null = null;

async function searchEntityClassifierEntities(args: SearchEntitiesArgs) {
  const parsedArgs = SearchEntitiesArgsSchema.parse(args);
  return (await searchClassifierEntities(parsedArgs)).map((result) =>
    EntityResolutionSchema.parse(result),
  );
}

export function getEntityClassifier() {
  if (entityClassifier) {
    return entityClassifier;
  }

  entityClassifier = createEntityClassifier({
    client: createOpenAIClient(),
    model: config.OPENAI_MODEL,
    maxSearchQueries: config.ENTITY_CLASSIFIER_MAX_SEARCH_QUERIES,
    adapters: {
      searchEntities: searchEntityClassifierEntities,
    },
  });

  return entityClassifier;
}

export async function classifyEntity(input: ClassifyEntityInput) {
  return await withSentryConversation(
    `entity:${input.reference.entity.id}`,
    async () => await getEntityClassifier().classifyEntity(input),
  );
}

export async function runEntityClassifierAgent(
  input: RunEntityClassifierAgentInput,
) {
  return await withSentryConversation(
    `entity:${input.reference.entity.id}`,
    async () => await getEntityClassifier().runEntityClassifierAgent(input),
  );
}
