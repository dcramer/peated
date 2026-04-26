import { tool } from "@openai/agents";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";

const SearchEntitiesResultSchema = EntityResolutionSchema.array();

export function createSearchEntitiesTool({
  onResults,
  searchEntities,
}: {
  onResults?: (results: EntityResolution[]) => void;
  searchEntities: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
}) {
  return tool({
    name: "search_entities",
    description:
      "Search the local entity database for likely sibling brands, distilleries, or bottlers. Use this before web search when you need to confirm whether a better existing producer row already exists locally.",
    parameters: SearchEntitiesArgsSchema,
    execute: async (args) => {
      const parsedArgs = SearchEntitiesArgsSchema.parse(args);
      const results = SearchEntitiesResultSchema.parse(
        await searchEntities(parsedArgs),
      );
      onResults?.(results);
      return { results };
    },
  });
}
