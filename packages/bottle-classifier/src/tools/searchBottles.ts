import { tool } from "@openai/agents";
import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
} from "../classifierSchemas";

const SearchBottlesResultSchema = z.object({
  results: z.array(BottleCandidateSchema),
});

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
    description:
      "Search the local bottle database using exact alias matching, embeddings, full-text search, and producer-aware heuristics. Results may be either bottle targets or specific release targets. Use this before web search when local candidates are thin, conflicting, or missing obvious near matches. Re-run it after web search when the web confirms a missing canonical trait such as Barrel Proof, Single Cask, a batch code, or a producer/distillery detail that could recover a better local match. Provide the most specific bottle identity you know, including brand, bottler, distillery, expression, series, edition, age, ABV, cask details, and years. Do not include packaging, volume, pricing, or retailer SEO noise in the query.",
    parameters: BottleCandidateSearchInputSchema.extend({
      query: BottleCandidateSearchInputSchema.shape.query.describe(
        "Raw bottle reference text or fallback search text. Exclude volume, pack-size, gift-set, and price noise when possible.",
      ),
      brand: BottleCandidateSearchInputSchema.shape.brand.describe(
        "Most prominent consumer-facing brand on the label. For independent bottlings, this is usually the bottler label, not the distillery.",
      ),
      bottler: BottleCandidateSearchInputSchema.shape.bottler.describe(
        "Separately stated bottler when different from the label brand. Leave null when the brand itself is the bottler.",
      ),
      expression: BottleCandidateSearchInputSchema.shape.expression.describe(
        "Core release name after removing brand, age, ABV, and generic style words.",
      ),
      series: BottleCandidateSearchInputSchema.shape.series.describe(
        "Stable range or family name such as Private Selection or Distillers Edition. Do not use for one-off batch codes.",
      ),
      distillery: BottleCandidateSearchInputSchema.shape.distillery.describe(
        "Producing distillery or distilleries when known. Use an empty array when unknown.",
      ),
      category: BottleCandidateSearchInputSchema.shape.category.describe(
        "Normalized whisky category when known. Leave null instead of guessing.",
      ),
      stated_age: BottleCandidateSearchInputSchema.shape.stated_age.describe(
        "Age statement in years.",
      ),
      abv: BottleCandidateSearchInputSchema.shape.abv.describe(
        "Alcohol by volume percentage as a number, for example 59.2. If the source gives proof, convert it to ABV first.",
      ),
      cask_type: BottleCandidateSearchInputSchema.shape.cask_type.describe(
        "Primary cask or finish wording such as First Fill Bourbon or PX Cask Finish.",
      ),
      cask_size: BottleCandidateSearchInputSchema.shape.cask_size.describe(
        "Normalized cask size when explicitly stated, such as port_pipe or hogshead.",
      ),
      cask_fill: BottleCandidateSearchInputSchema.shape.cask_fill.describe(
        "Normalized cask fill when explicitly stated, such as 1st_fill or refill.",
      ),
      cask_strength:
        BottleCandidateSearchInputSchema.shape.cask_strength.describe(
          "True only when the reference explicitly says cask strength, barrel strength, barrel proof, full proof, or natural strength.",
        ),
      single_cask: BottleCandidateSearchInputSchema.shape.single_cask.describe(
        "True only when the reference explicitly says single cask, single barrel, or a specific cask selection.",
      ),
      edition: BottleCandidateSearchInputSchema.shape.edition.describe(
        "Batch label, store-pick code, release code, or numbered edition such as Batch 3 or S2B13.",
      ),
      vintage_year:
        BottleCandidateSearchInputSchema.shape.vintage_year.describe(
          "Distillation year when explicitly stated.",
        ),
      release_year:
        BottleCandidateSearchInputSchema.shape.release_year.describe(
          "Bottling or release year when explicitly stated.",
        ),
      currentBottleId:
        BottleCandidateSearchInputSchema.shape.currentBottleId.describe(
          "Current assigned bottle id, if the reference is already attached to a bottle.",
        ),
      currentReleaseId:
        BottleCandidateSearchInputSchema.shape.currentReleaseId.describe(
          "Current assigned release id, if the reference is already attached to a specific release.",
        ),
      limit: BottleCandidateSearchInputSchema.shape.limit.describe(
        "Maximum number of candidates to return.",
      ),
    }),
    execute: async (args) => {
      const results = await searchBottles(args);
      onResults?.(results);
      return SearchBottlesResultSchema.parse({
        results,
      });
    },
  });
}
