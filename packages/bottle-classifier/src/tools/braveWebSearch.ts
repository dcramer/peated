import { tool } from "@openai/agents";
import { z } from "zod";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import {
  BottleWebSearchArgsSchema,
  BottleWebSearchErrorSchema,
  buildBottleSearchEvidence,
  compactBottleSearchEvidence,
  getResultDomain,
  summarizeSearchResults,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutionCache,
} from "./sharedWebSearch";

const BRAVE_WEB_SEARCH_TIMEOUT_MS = 8000;

const BraveWebSearchResponseSchema = z.object({
  web: z
    .object({
      results: z
        .array(
          z.object({
            title: z.string().trim().min(1),
            url: z.string().url(),
            description: z.string().nullable().optional(),
            extra_snippets: z.array(z.string()).default([]),
          }),
        )
        .default([]),
    })
    .default({
      results: [],
    }),
});

const BraveWebSearchToolResultSchema = z.union([
  BottleSearchEvidenceSchema,
  BottleWebSearchErrorSchema,
]);

const BraveWebSearchToolCachePayloadSchema = z.object({
  emittedEvidence: z.array(BottleSearchEvidenceSchema),
  result: BraveWebSearchToolResultSchema,
});

export function extractBraveSearchEvidence(
  query: string,
  payload: unknown,
): BottleSearchEvidence {
  const response = BraveWebSearchResponseSchema.parse(payload);
  const results = response.web.results.map((result) => ({
    title: result.title,
    url: result.url,
    domain: getResultDomain(result.url),
    description: result.description ?? null,
    extraSnippets: result.extra_snippets,
  }));

  return buildBottleSearchEvidence({
    provider: "brave",
    query,
    summary: summarizeSearchResults(results),
    results,
  });
}

export function createBraveWebSearchTool({
  apiKey,
  budget,
  cache,
  onEvidence,
}: {
  apiKey: string;
  budget: BottleWebSearchBudget;
  cache?: BottleWebSearchExecutionCache;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "brave_web_search",
    description:
      "Search the live web using Brave Search's independent index. Use this after `openai_web_search` when the first search returns sparse results, mostly retailer pages, or lacks authoritative producer or critic domains. Brave is useful as a second opinion from a different index and can return extra snippets for better evidence review.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      if (!budget.tryConsume()) {
        return budget.getExhaustedError();
      }

      const runLiveSearch = async () => {
        const result = await runBraveWebSearch({
          apiKey,
          query: args.query,
        });

        return {
          emittedEvidence:
            "error" in result || result.results.length === 0 ? [] : [result],
          result,
        };
      };
      const cached = cache
        ? await cache.execute({
            key: {
              toolName: "brave_web_search",
              query: args.query,
            },
            schema: BraveWebSearchToolCachePayloadSchema,
            live: runLiveSearch,
          })
        : await runLiveSearch();
      const emittedEvidence = cached.emittedEvidence.map(
        compactBottleSearchEvidence,
      );
      const evidence =
        "error" in cached.result
          ? cached.result
          : compactBottleSearchEvidence(cached.result);

      for (const emitted of emittedEvidence) {
        onEvidence?.(emitted);
      }

      if ("error" in evidence) {
        return evidence;
      }
      return evidence;
    },
  });
}

export async function runBraveWebSearch({
  apiKey,
  query,
}: {
  apiKey: string;
  query: string;
}): Promise<BottleSearchEvidence | { error: string }> {
  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");
    url.searchParams.set("extra_snippets", "false");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(BRAVE_WEB_SEARCH_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      return {
        error: `Brave web search failed (${response.status})`,
      };
    }

    return extractBraveSearchEvidence(query, await response.json());
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Brave web search failed: ${error.message}`
          : "Brave web search failed",
    };
  }
}
