import { tool } from "@openai/agents";
import { z } from "zod";
import {
  AgentBottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
} from "../classifierTypes";
import { startToolSpan } from "../observability";

export const SearchBottlesResultSchema = z.object({
  results: z.array(AgentBottleCandidateSchema),
});
const SEARCH_BOTTLES_TOOL_DESCRIPTION =
  "Search local Peated Bottle candidates. Use before web search when local matches are missing or conflicting, and again after web evidence reveals a canonical trait that could recover a better local candidate.";

export type SearchBottlesResult = z.infer<typeof SearchBottlesResultSchema>;

export function createSearchBottlesTool({
  searchBottles,
  onResults,
}: {
  searchBottles: (
    args: BottleCandidateSearchInput,
  ) => Promise<BottleCandidate[]>;
  onResults?: (results: BottleCandidate[]) => void;
}) {
  return tool({
    name: "search_bottles",
    description: SEARCH_BOTTLES_TOOL_DESCRIPTION,
    parameters: BottleCandidateSearchInputSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "search_bottles",
        description: SEARCH_BOTTLES_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          const results = await searchBottles(args);
          onResults?.(results);
          return SearchBottlesResultSchema.parse({
            results,
          });
        },
      });
    },
  });
}
