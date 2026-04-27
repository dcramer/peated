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
import OpenAI from "openai";

let entityClassifier: ReturnType<typeof createEntityClassifier> | null = null;

function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });
}

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
  return await getEntityClassifier().classifyEntity(input);
}

export async function runEntityClassifierAgent(
  input: RunEntityClassifierAgentInput,
) {
  return await getEntityClassifier().runEntityClassifierAgent(input);
}
