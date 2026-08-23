import { tool } from "@openai/agents";
import { z } from "zod";
import type { BottleSearchEvidence } from "../classifierTypes";
import { startToolSpan } from "../observability";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  executeBottleWebSearchInvocation,
  getResultDomain,
  hydrateBottleSearchEvidence,
  type BottleWebSearchBatchResult,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev";
const FIRECRAWL_SEARCH_TIMEOUT_MS = 30000;
const FIRECRAWL_WEB_SEARCH_TOOL_DESCRIPTION =
  "Search public web pages for bottle-specific evidence. Use when local catalog and supplied label evidence cannot resolve an identity-critical fact, including a disputed bottler or stored field. Run one focused query normally; use two query formulations together only when wording is genuinely uncertain. Returns ranked source URLs, titles, and compact relevance snippets. A separate page-read allowance is reserved for exact verification.";
const FirecrawlPayloadSchema = z.json();
type FirecrawlPayload = z.infer<typeof FirecrawlPayloadSchema>;

const FirecrawlSearchResultSchema = z
  .object({
    title: z.string().trim().min(1).nullable().optional(),
    url: z.string().url(),
    description: z.string().nullable().optional(),
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

function buildFirecrawlSearchBody(query: string) {
  return {
    query,
    limit: 5,
    sources: ["web"],
  };
}

export function extractFirecrawlSearchEvidence(
  query: string,
  payload: FirecrawlPayload,
): BottleSearchEvidence {
  const response = FirecrawlSearchResponseSchema.parse(payload);
  const results = response.data.web.map((result) => {
    return {
      title: result.title?.trim() || result.url,
      url: result.url,
      domain: getResultDomain(result.url),
      description: result.description ?? null,
      extraSnippets: [],
    };
  });

  return buildBottleSearchEvidence({
    provider: "firecrawl",
    query,
    summary: results
      .map((result) => result.description)
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
  executeWebSearch,
}: {
  apiKey: string;
  apiUrl?: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  executeWebSearch?: BottleWebSearchExecutor;
}) {
  return tool({
    name: "firecrawl_web_search",
    description: FIRECRAWL_WEB_SEARCH_TOOL_DESCRIPTION,
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "firecrawl_web_search",
        description: FIRECRAWL_WEB_SEARCH_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          let evidenceHydrated = false;
          const hydrateEvidence = (evidence: BottleSearchEvidence) => {
            evidenceHydrated = true;
            onEvidence?.(evidence);
          };
          const execute = async (): Promise<BottleWebSearchBatchResult> => {
            const results = await Promise.all(
              args.queries.map(async (query) => ({
                query,
                result: await runFirecrawlWebSearch({
                  apiKey,
                  apiUrl,
                  query,
                }),
              })),
            );
            const evidence = results.flatMap(({ result }) =>
              "error" in result ? [] : [result],
            );

            for (const item of evidence) {
              if (item.results.length > 0) {
                hydrateEvidence(item);
              }
            }

            return {
              evidence,
              errors: results.flatMap(({ query, result }) =>
                "error" in result ? [{ query, error: result.error }] : [],
              ),
            };
          };
          const result = await executeBottleWebSearchInvocation({
            budget,
            budgetUnits: args.queries.length,
            toolName: "firecrawl_web_search",
            args,
            execute,
            executeWebSearch,
          });

          if (executeWebSearch && !evidenceHydrated) {
            hydrateBottleSearchEvidence(result, hydrateEvidence);
          }

          return result;
        },
      });
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

    return extractFirecrawlSearchEvidence(
      query,
      FirecrawlPayloadSchema.parse(await response.json()),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Firecrawl search failed: ${error.message}`
          : "Firecrawl search failed",
    };
  }
}
