import { strictAgentTool, type AgentTool } from "@peated/agent-run";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";

const SearchEntitiesResultSchema = EntityResolutionSchema.array();
const SEARCH_ENTITIES_TOOL_DESCRIPTION =
  "Search one Entity kind in the local database for likely sibling identities. Use this before web search when you need to confirm whether a better existing producer row already exists locally.";

export function createSearchEntitiesTool({
  onResults,
  searchEntities,
}: {
  onResults?: (results: EntityResolution[]) => void;
  searchEntities: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
}): AgentTool {
  return strictAgentTool({
    name: "search_entities",
    description: SEARCH_ENTITIES_TOOL_DESCRIPTION,
    parameters: SearchEntitiesArgsSchema,
    execute: async (args) => {
      const results = SearchEntitiesResultSchema.parse(
        await searchEntities(args),
      );
      onResults?.(results);
      return { results };
    },
  });
}
