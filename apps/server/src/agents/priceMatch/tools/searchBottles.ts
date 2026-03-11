import { tool } from "@openai/agents";
import {
  BottleCandidateSearchInputSchema,
  findBottleMatchCandidates,
} from "@peated/server/lib/priceMatchingCandidates";
import { PriceMatchCandidateSchema } from "@peated/server/schemas";
import { z } from "zod";

const SearchBottlesResultSchema = z.object({
  results: z.array(PriceMatchCandidateSchema),
});

export type SearchBottlesResult = z.infer<typeof SearchBottlesResultSchema>;

export function createSearchBottlesTool({
  onResults,
}: {
  onResults?: (results: z.infer<typeof PriceMatchCandidateSchema>[]) => void;
}) {
  return tool({
    name: "search_bottles",
    description:
      "Search the local bottle database using exact alias matching, embeddings, full-text search, and producer-aware heuristics.",
    parameters: BottleCandidateSearchInputSchema,
    execute: async (args) => {
      const results = await findBottleMatchCandidates(args);
      onResults?.(results);
      return SearchBottlesResultSchema.parse({
        results,
      });
    },
  });
}
