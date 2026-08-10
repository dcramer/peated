import { z } from "zod";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import { canonicalizeWebEvidenceUrl } from "../webEvidenceUrl";

export const BottleWebSearchProviderSchema = z.enum(["openai", "firecrawl"]);
export type BottleWebSearchProvider = z.infer<
  typeof BottleWebSearchProviderSchema
>;

const BottleWebSearchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .describe(
    "Focused discovery query for one exact Bottle. Include the brand plus reliable identity anchors. When an extracted age, ABV, year, edition, or cask marker is uncertain or disputed, one formulation may omit only that field so search can surface corrective evidence. Firecrawl supports quoted non-fuzzy fragments for unusual exact markers.",
  );

export const BottleWebSearchArgsSchema = z.object({
  queries: z
    .array(BottleWebSearchQuerySchema)
    .min(1)
    .max(3)
    .refine(
      (queries) =>
        new Set(queries.map((query) => query.toLowerCase())).size ===
        queries.length,
      { message: "Search queries must be distinct" },
    )
    .describe(
      "One focused query, or up to three distinct formulations when wording or an extracted trait is uncertain. Search discovers candidates; each returned result still requires exact-product validation before it becomes evidence. Each query consumes one unit of the web-evidence budget.",
    ),
});

export const BottleWebReadPageArgsSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "URL must use HTTP or HTTPS",
    })
    .describe(
      "Exact URL of a promising search result consistent with confirmed Bottle traits, or differing only on the uncertain trait being resolved. Never use a confirmed conflicting sibling as Suggested Change evidence.",
    ),
  focus: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .describe(
      "Short description of the identity-critical fact to locate, such as exact cask code, edition, age, year, or ABV.",
    ),
});

export const BottleWebSearchErrorSchema = z.object({
  error: z.string().min(1),
});

const MAX_BOTTLE_SEARCH_RESULTS = 6;
export const MAX_BOTTLE_SEARCH_SUMMARY_CHARS = 1200;
const MAX_BOTTLE_SEARCH_TITLE_CHARS = 160;
const MAX_BOTTLE_SEARCH_DESCRIPTION_CHARS = 220;
const MAX_BOTTLE_SEARCH_EXTRA_SNIPPETS = 1;
const MAX_BOTTLE_SEARCH_EXTRA_SNIPPET_CHARS = 1200;

export type BottleWebSearchBudget = {
  tryConsume: (units?: number) => boolean;
  getExhaustedError: () => {
    error: string;
  };
};

export type BottleWebSearchBatchResult = {
  evidence: BottleSearchEvidence[];
  errors: Array<{ query: string; error: string }>;
};

export type BottleWebToolResult =
  | BottleSearchEvidence
  | BottleWebSearchBatchResult
  | { error: string };

export type BottleWebSearchExecutor = (input: {
  toolName: "firecrawl_web_search" | "firecrawl_read_page";
  args: { queries: string[] } | { url: string; focus: string };
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
  toolName: "firecrawl_web_search" | "firecrawl_read_page";
  args: { queries: string[] } | { url: string; focus: string };
  execute: () => Promise<BottleWebToolResult>;
  executeWebSearch?: BottleWebSearchExecutor;
}): Promise<BottleWebToolResult> {
  if (!budget.tryConsume(budgetUnits)) {
    return budget.getExhaustedError();
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

export function createBottleWebSearchBudget(
  maxUnits: number,
): BottleWebSearchBudget {
  let consumedUnits = 0;

  return {
    tryConsume: (units = 1) => {
      if (units < 1 || consumedUnits + units > maxUnits) {
        return false;
      }

      consumedUnits += units;
      return true;
    },
    getExhaustedError: () => ({
      error: `Web evidence budget exhausted after ${maxUnits} units`,
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

export function compactBottleSearchEvidence(
  evidence: BottleSearchEvidence,
): BottleSearchEvidence {
  return buildBottleSearchEvidence(evidence);
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
