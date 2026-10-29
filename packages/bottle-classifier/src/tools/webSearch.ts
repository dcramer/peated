import { tool } from "@openai/agents";
import type { BottleSearchEvidence } from "../classifierTypes";
import { startToolSpan } from "../observability";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  executeBottleWebSearchInvocation,
  getResultDomain,
  hydrateBottleSearchEvidence,
  type BottleClassifierWeb,
  type BottleWebSearchBatchResult,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";

const WEB_SEARCH_TOOL_DESCRIPTION =
  "Search public web pages for bottle-specific evidence. Use when local catalog and supplied label evidence cannot resolve an identity-critical fact, including a disputed bottler or stored field. Run one focused query normally; use two query formulations together only when wording is genuinely uncertain. Returns ranked source URLs, titles, and compact relevance snippets. A separate page-read allowance is reserved for exact verification.";

// Eight results per query give the model more than the top retailer hits
// without a second query. Replay recordings key on the query, not this limit.
const WEB_SEARCH_RESULT_LIMIT = 8;

export function createWebSearchTool({
  web,
  budget,
  onEvidence,
  executeWebSearch,
}: {
  web: BottleClassifierWeb;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  executeWebSearch?: BottleWebSearchExecutor;
}) {
  return tool({
    name: "web_search",
    description: WEB_SEARCH_TOOL_DESCRIPTION,
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "web_search",
        description: WEB_SEARCH_TOOL_DESCRIPTION,
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
                result: await runWebSearch({ web, query }),
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
            toolName: "web_search",
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

/** Runs one search through PeatedBot and turns its links into evidence. */
export async function runWebSearch({
  web,
  query,
}: {
  web: BottleClassifierWeb;
  query: string;
}): Promise<BottleSearchEvidence | { error: string }> {
  const search = await web.searchWeb({
    query,
    limit: WEB_SEARCH_RESULT_LIMIT,
  });
  if (search.status === "failed") {
    return {
      error: `Web search failed${search.httpStatus ? ` (${search.httpStatus})` : ""}`,
    };
  }

  const results = search.results.map((result) => ({
    title: result.title,
    url: result.url,
    domain: getResultDomain(result.url),
    description: result.description,
    extraSnippets: [],
  }));
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
