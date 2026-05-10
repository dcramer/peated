import { tool } from "@openai/agents";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  SearchEntitiesResultSchema,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";

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
      "Search local Peated brand, distillery, and bottler entities. Use when producer identity is blocking a match or create decision. Do not use for bottles.",
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
