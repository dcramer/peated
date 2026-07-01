import { tool } from "@openai/agents";
import { z } from "zod";
import type { BottleSearchEvidence } from "../classifierTypes";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  getResultDomain,
  type BottleWebSearchBudget,
} from "./sharedWebSearch";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev";
const FIRECRAWL_SEARCH_TIMEOUT_MS = 30000;

const FirecrawlSearchResultSchema = z
  .object({
    title: z.string().trim().min(1).nullable().optional(),
    url: z.string().url(),
    description: z.string().nullable().optional(),
    markdown: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
  })
  .passthrough();

const FirecrawlSearchResponseSchema = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        web: z.array(FirecrawlSearchResultSchema).default([]),
      })
      .passthrough(),
  })
  .passthrough();

function compactMarkdown(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 1200);
}

function buildFirecrawlSearchBody(query: string) {
  return {
    query,
    limit: 5,
    sources: [{ type: "web" }],
    scrapeOptions: {
      formats: [{ type: "markdown" }],
      onlyMainContent: true,
    },
  };
}

export function extractFirecrawlSearchEvidence(
  query: string,
  payload: unknown,
): BottleSearchEvidence {
  const response = FirecrawlSearchResponseSchema.parse(payload);
  const results = response.data.web.map((result) => {
    const markdown = compactMarkdown(result.markdown ?? result.content);
    return {
      title: result.title?.trim() || result.url,
      url: result.url,
      domain: getResultDomain(result.url),
      description: result.description ?? null,
      extraSnippets: markdown ? [markdown] : [],
    };
  });

  return buildBottleSearchEvidence({
    provider: "firecrawl",
    query,
    summary: results
      .flatMap((result) => [result.description, ...result.extraSnippets])
      .filter(Boolean)
      .join(" ")
      .slice(0, 600),
    results,
  });
}

export function createFirecrawlWebSearchTool({
  apiKey,
  apiUrl = FIRECRAWL_API_URL,
  budget,
  onEvidence,
}: {
  apiKey: string;
  apiUrl?: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "firecrawl_web_search",
    description:
      "Search web pages and return readable page excerpts for decisive bottle or release evidence. Use focused queries when local search is insufficient, especially when exact ABV, cask, vintage, or bottle/release scope matters.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      if (!budget.tryConsume()) {
        return budget.getExhaustedError();
      }

      const evidence = await runFirecrawlWebSearch({
        apiKey,
        apiUrl,
        query: args.query,
      });

      if (!("error" in evidence) && evidence.results.length > 0) {
        onEvidence?.(evidence);
      }

      return evidence;
    },
  });
}

export async function runFirecrawlWebSearch({
  apiKey,
  apiUrl = FIRECRAWL_API_URL,
  query,
}: {
  apiKey: string;
  apiUrl?: string;
  query: string;
}): Promise<BottleSearchEvidence | { error: string }> {
  try {
    const response = await fetch(new URL("/v2/search", apiUrl), {
      method: "POST",
      signal: AbortSignal.timeout(FIRECRAWL_SEARCH_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildFirecrawlSearchBody(query)),
    });

    if (!response.ok) {
      return {
        error: `Firecrawl search failed (${response.status})`,
      };
    }

    return extractFirecrawlSearchEvidence(query, await response.json());
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Firecrawl search failed: ${error.message}`
          : "Firecrawl search failed",
    };
  }
}
