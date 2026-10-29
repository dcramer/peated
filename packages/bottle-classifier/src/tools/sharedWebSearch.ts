import type { PeatedBot } from "@peated/bot";
import { z } from "zod";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import { canonicalizeWebEvidenceUrl } from "../webEvidenceUrl";

export const BottleWebSearchProviderSchema = z.enum(["openai", "firecrawl"]);

/** How the classifier reaches the web: PeatedBot's page reader and search. */
export type BottleClassifierWeb = Pick<PeatedBot, "readPage" | "searchWeb">;

/** Web tools whose calls the eval harness records and replays. */
export type BottleWebToolName = "web_search" | "read_page";

/** One page's text, kept for the run so `find_in_page` can search it. */
export type BottleWebPage = {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
};
export type BottleWebSearchProvider = z.infer<
  typeof BottleWebSearchProviderSchema
>;

const BottleWebSearchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .describe(
    "Focused discovery query for one exact Bottle. Include the brand plus reliable identity anchors. When an extracted age, ABV, year, edition, or cask marker is uncertain or disputed, one formulation may omit only that field so search can surface corrective evidence. Quoted fragments match unusual exact markers.",
  );

export const BottleWebSearchArgsSchema = z.object({
  queries: z
    .array(BottleWebSearchQuerySchema)
    .min(1)
    .max(2)
    .refine(
      (queries) =>
        new Set(queries.map((query) => query.toLowerCase())).size ===
        queries.length,
      { message: "Search queries must be distinct" },
    )
    .describe(
      "One focused query, or two distinct formulations when wording or an extracted trait is uncertain. Search discovers candidates; each returned result still requires exact-product validation before it becomes evidence. Each query consumes one search allowance; page verification has a separate reserved allowance.",
    ),
});

const BottleWebPageUrlSchema = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "URL must use HTTP or HTTPS",
  });

export const BottleWebReadPageArgsSchema = z.object({
  url: BottleWebPageUrlSchema.describe(
    "Exact source URL from `reference.url`, or a promising search result consistent with confirmed Bottle traits or differing only on the uncertain trait being resolved. Never use a confirmed conflicting sibling as Suggested Change evidence.",
  ),
});

export const BottleWebFindInPageArgsSchema = z.object({
  url: BottleWebPageUrlSchema.describe(
    "URL of a page already read in this run with `read_page`.",
  ),
  query: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .describe(
      "Exact word, number, or short phrase to find on the page, such as `cask`, `48.2%`, `bottled`, `Vol. 3`, or a cask code. Matching ignores case.",
    ),
});

const MAX_BOTTLE_SEARCH_RESULTS = 6;
export const MAX_BOTTLE_SEARCH_SUMMARY_CHARS = 1200;
const MAX_BOTTLE_SEARCH_TITLE_CHARS = 160;
const MAX_BOTTLE_SEARCH_DESCRIPTION_CHARS = 220;
const MAX_BOTTLE_SEARCH_EXTRA_SNIPPETS = 1;
const MAX_BOTTLE_SEARCH_EXTRA_SNIPPET_CHARS = 1200;

/**
 * One run's web allowance, plus the pages it has read. Pages stay in memory
 * for the run, so `find_in_page` searches them without reading them again.
 */
export type BottleWebSearchBudget = {
  tryConsumeSearch: (queries?: number) => boolean;
  tryConsumePageRead: () => boolean;
  tryConsumePageFind: () => boolean;
  getExhaustedError: (kind: "search" | "page_read" | "page_find") => {
    error: string;
  };
  pages: Map<string, BottleWebPage>;
};

export type BottleWebSearchBatchResult = {
  evidence: BottleSearchEvidence[];
  errors: Array<{ query: string; error: string }>;
};

export type BottleWebToolResult =
  | BottleSearchEvidence
  | BottleWebSearchBatchResult
  | { page: BottleWebPage }
  | { error: string };

export type BottleWebSearchExecutor = (input: {
  toolName: BottleWebToolName;
  args: { queries: string[] } | { url: string };
  execute: () => Promise<BottleWebToolResult>;
}) => Promise<BottleWebToolResult>;

export async function executeBottleWebSearchInvocation({
  budget,
  budgetUnits = 1,
  toolName,
  args,
  execute,
  executeWebSearch,
}: {
  budget: BottleWebSearchBudget;
  budgetUnits?: number;
  toolName: BottleWebToolName;
  args: { queries: string[] } | { url: string };
  execute: () => Promise<BottleWebToolResult>;
  executeWebSearch?: BottleWebSearchExecutor;
}): Promise<BottleWebToolResult> {
  const budgetKind = toolName === "web_search" ? "search" : "page_read";
  const allowed =
    budgetKind === "search"
      ? budget.tryConsumeSearch(budgetUnits)
      : budget.tryConsumePageRead();
  if (!allowed) {
    return budget.getExhaustedError(budgetKind);
  }

  return executeWebSearch
    ? await executeWebSearch({ toolName, args, execute })
    : await execute();
}

export function hydrateBottleSearchEvidence(
  result: BottleWebToolResult,
  onEvidence?: (evidence: BottleSearchEvidence) => void,
): boolean {
  if ("evidence" in result) {
    let hydrated = false;
    for (const evidence of result.evidence) {
      hydrated = hydrateBottleSearchEvidence(evidence, onEvidence) || hydrated;
    }
    return hydrated;
  }

  const parsed = BottleSearchEvidenceSchema.safeParse(result);
  if (!parsed.success || parsed.data.results.length === 0) {
    return false;
  }

  onEvidence?.(parsed.data);
  return true;
}

// Finds search text already read, so they cost no web request; the limit
// only bounds the run's turns (agent design policy).
const MAX_PAGE_FINDS = 6;

export function createBottleWebSearchBudget(
  maxSearchQueries: number,
  maxPageReads = 1,
): BottleWebSearchBudget {
  let consumedSearchQueries = 0;
  let consumedPageReads = 0;
  let consumedPageFinds = 0;

  return {
    tryConsumeSearch: (queries = 1) => {
      if (queries < 1 || consumedSearchQueries + queries > maxSearchQueries) {
        return false;
      }

      consumedSearchQueries += queries;
      return true;
    },
    tryConsumePageRead: () => {
      if (consumedPageReads >= maxPageReads) {
        return false;
      }

      consumedPageReads += 1;
      return true;
    },
    tryConsumePageFind: () => {
      if (consumedPageFinds >= MAX_PAGE_FINDS) {
        return false;
      }

      consumedPageFinds += 1;
      return true;
    },
    getExhaustedError: (kind) => ({
      error:
        kind === "search"
          ? `Web search budget exhausted after ${maxSearchQueries} ${maxSearchQueries === 1 ? "query" : "queries"}`
          : kind === "page_read"
            ? `Web page-read budget exhausted after ${maxPageReads} ${maxPageReads === 1 ? "page" : "pages"}`
            : `Find-in-page budget exhausted after ${MAX_PAGE_FINDS} finds`,
    }),
    pages: new Map(),
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
  const normalizedSummary = normalizeSearchText(
    summary,
    MAX_BOTTLE_SEARCH_SUMMARY_CHARS,
  );

  return BottleSearchEvidenceSchema.parse({
    provider,
    query,
    summary: normalizedSummary,
    results: results.slice(0, MAX_BOTTLE_SEARCH_RESULTS).map((result) =>
      normalizeBottleSearchResult({
        result,
        summary: normalizedSummary,
      }),
    ),
  });
}

function normalizeSearchText(
  value: string | null | undefined,
  maxChars: number,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxChars);
}

function normalizeSearchComparisonText(
  value: string | null | undefined,
): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeBottleSearchResult({
  result,
  summary,
}: {
  result: BottleSearchEvidence["results"][number];
  summary: string | null;
}): BottleSearchEvidence["results"][number] {
  const normalizedSummary = normalizeSearchComparisonText(summary);
  const normalizedDescription = normalizeSearchText(
    result.description,
    MAX_BOTTLE_SEARCH_DESCRIPTION_CHARS,
  );
  const description =
    normalizedDescription &&
    normalizeSearchComparisonText(normalizedDescription) === normalizedSummary
      ? null
      : normalizedDescription;
  const extraSnippets = Array.from(
    new Set(
      result.extraSnippets
        .map((snippet) =>
          normalizeSearchText(snippet, MAX_BOTTLE_SEARCH_EXTRA_SNIPPET_CHARS),
        )
        .filter(
          (snippet): snippet is string =>
            Boolean(snippet) &&
            normalizeSearchComparisonText(snippet) !== normalizedSummary &&
            normalizeSearchComparisonText(snippet) !==
              normalizeSearchComparisonText(description),
        ),
    ),
  ).slice(0, MAX_BOTTLE_SEARCH_EXTRA_SNIPPETS);

  return {
    ...result,
    url: canonicalizeWebEvidenceUrl(result.url),
    title:
      normalizeSearchText(result.title, MAX_BOTTLE_SEARCH_TITLE_CHARS) ??
      result.url,
    description,
    extraSnippets,
  };
}
