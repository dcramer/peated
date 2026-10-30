import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  SearchEntitiesResultSchema,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";
import { startToolSpan } from "../observability";
import { strictAgentTool } from "../runtime/agentRun";

export type EntitySearchResult = EntityResolution;
const SEARCH_ENTITIES_TOOL_DESCRIPTION =
  "Search local Peated brand, distillery, and bottler entities. Use when producer identity is blocking a match or create decision. Do not use for bottles.";

export function createSearchEntitiesTool(
  {
    searchEntities,
    onResults,
  }: {
    searchEntities: (args: SearchEntitiesArgs) => Promise<EntitySearchResult[]>;
    onResults?: (
      results: EntitySearchResult[],
      args: SearchEntitiesArgs,
    ) => void;
  } = {
    searchEntities: async () => [],
  },
) {
  return strictAgentTool({
    name: "search_entities",
    description: SEARCH_ENTITIES_TOOL_DESCRIPTION,
    parameters: SearchEntitiesArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "search_entities",
        description: SEARCH_ENTITIES_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          const results = await searchEntities(args);
          const parsedResults = SearchEntitiesResultSchema.parse({
            results,
          });

          onResults?.(parsedResults.results, args);
          return parsedResults;
        },
      });
    },
  });
}
