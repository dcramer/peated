import { tool } from "@openai/agents";
import { z } from "zod";
import type { BottleSearchEvidence } from "../classifierTypes";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  compactBottleSearchEvidence,
  getResultDomain,
  summarizeSearchResults,
  type BottleWebSearchBudget,
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
  onEvidence,
}: {
  apiKey: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "brave_web_search",
    description:
      "Search Brave as a second web index when OpenAI web search is sparse, retailer-heavy, or lacks corroboration.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      if (!budget.tryConsume()) {
        return budget.getExhaustedError();
      }

      const result = await runBraveWebSearch({
        apiKey,
        query: args.query,
      });
      const evidence =
        "error" in result ? result : compactBottleSearchEvidence(result);

      if (!("error" in evidence) && evidence.results.length > 0) {
        onEvidence?.(evidence);
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
