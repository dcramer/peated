import { tool } from "@openai/agents";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";
import { startToolSpan } from "../observability";

const SearchEntitiesResultSchema = EntityResolutionSchema.array();
const SEARCH_ENTITIES_TOOL_DESCRIPTION =
  "Search the local entity database for likely sibling brands, distilleries, or bottlers. Use this before web search when you need to confirm whether a better existing producer row already exists locally.";

export function createSearchEntitiesTool({
  onResults,
  searchEntities,
}: {
  onResults?: (results: EntityResolution[]) => void;
  searchEntities: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
}) {
  return tool({
    name: "search_entities",
    description: SEARCH_ENTITIES_TOOL_DESCRIPTION,
    parameters: SearchEntitiesArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "search_entities",
        description: SEARCH_ENTITIES_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          const parsedArgs = SearchEntitiesArgsSchema.parse(args);
          const results = SearchEntitiesResultSchema.parse(
            await searchEntities(parsedArgs),
          );
          onResults?.(results);
          return { results };
        },
      });
    },
  });
}
