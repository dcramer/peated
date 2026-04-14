import { tool } from "@openai/agents";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  SearchEntitiesResultSchema,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierSchemas";

export const EntitySearchResultSchema = EntityResolutionSchema;
export type EntitySearchResult = EntityResolution;

export function createSearchEntitiesTool(
  {
    searchEntities,
    onResults,
  }: {
    searchEntities: (args: SearchEntitiesArgs) => Promise<EntitySearchResult[]>;
    onResults?: (results: EntitySearchResult[]) => void;
  } = {
    searchEntities: async () => [],
  },
) {
  return tool({
    name: "search_entities",
    description:
      "Search the local entity database for brands, distilleries, and bottlers using aliases and full-text search. Use this when producer, bottler, or distillery identity is blocking the decision. Prefer passing a `type` hint when you know what kind of entity you need. Do not use this to search for bottles.",
    parameters: SearchEntitiesArgsSchema,
    execute: async (args) => {
      const results = await searchEntities(args);
      const parsedResults = SearchEntitiesResultSchema.parse({
        results,
      });

      onResults?.(parsedResults.results);
      return parsedResults;
    },
  });
}
