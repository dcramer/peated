import { z } from "zod";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../schemas";

export const BottleWebSearchProviderSchema = z.enum(["openai", "brave"]);
export type BottleWebSearchProvider = z.infer<
  typeof BottleWebSearchProviderSchema
>;

export const BottleWebSearchArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe(
      "A focused web search query for corroborating bottle evidence. Prefer producer, distillery, bottler, or importer terms over broad whisky keywords, and search for the exact trait that needs validation. When the source text may have omitted a canonical trait, search for the exact base bottle name plus the missing trait, such as barrel proof, edition, or ABV.",
    ),
});

export type BottleWebSearchBudget = {
  tryConsume: () => boolean;
  getExhaustedError: () => {
    error: string;
  };
};

export function createBottleWebSearchBudget(
  maxQueries: number,
): BottleWebSearchBudget {
  let searchCalls = 0;

  return {
    tryConsume: () => {
      if (searchCalls >= maxQueries) {
        return false;
      }

      searchCalls += 1;
      return true;
    },
    getExhaustedError: () => ({
      error: `Search budget exhausted after ${maxQueries} queries`,
    }),
  };
}

export function getResultDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

export function buildBottleSearchEvidence({
  provider,
  query,
  summary,
  results,
}: {
  provider: BottleWebSearchProvider;
  query: string;
  summary: string | null;
  results: BottleSearchEvidence["results"];
}): BottleSearchEvidence {
  return BottleSearchEvidenceSchema.parse({
    provider,
    query,
    summary,
    results,
  });
}

export function summarizeSearchResults(
  results: Pick<
    BottleSearchEvidence["results"][number],
    "description" | "extraSnippets"
  >[],
): string | null {
  const snippets = results
    .flatMap((result) => [result.description, ...result.extraSnippets])
    .filter((value): value is string => !!value && value.trim().length > 0);

  if (!snippets.length) {
    return null;
  }

  return snippets.join(" ").slice(0, 600);
}
