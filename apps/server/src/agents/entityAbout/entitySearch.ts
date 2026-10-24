import { tool } from "@openai/agents";
import { searchClassifierEntities } from "@peated/server/lib/classifierEntitySearch";
import { z } from "zod";

const ENTITY_SEARCH_LIMIT = 5;

/**
 * Searches Peated's distilleries, brands, bottlers, and companies by name and
 * alias with the classifiers' Entity search. Every returned ID is added to
 * `entitiesFound`, the only IDs the writer may link.
 */
export function createEntitySearchTool(entitiesFound: Set<number>) {
  return tool({
    name: "search_entities",
    description:
      "Search Peated's distilleries, brands, bottlers, and companies by name or alias. Use it to link an owner or another Entity an event names. Results are Peated records, not evidence for facts.",
    parameters: z.object({
      query: z.string().trim().min(1).max(200),
    }),
    execute: async ({ query }) => {
      const results = await searchClassifierEntities({
        query,
        limit: ENTITY_SEARCH_LIMIT,
      });
      for (const result of results) entitiesFound.add(result.entityId);
      return {
        results: results.map(({ entityId, name, kind }) => ({
          entityId,
          name,
          kind,
        })),
      };
    },
  });
}
