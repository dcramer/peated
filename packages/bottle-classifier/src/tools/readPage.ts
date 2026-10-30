import type { PageRead } from "@peated/bot";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import { startToolSpan } from "../observability";
import { strictAgentTool } from "../runtime/agentRun";
import { canonicalizeWebEvidenceUrl } from "../webEvidenceUrl";
import {
  BottleWebFindInPageArgsSchema,
  BottleWebReadPageArgsSchema,
  executeBottleWebSearchInvocation,
  getResultDomain,
  type BottleClassifierWeb,
  type BottleWebPage,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutor,
  type BottleWebToolResult,
} from "./sharedWebSearch";

// The model sees a page's opening; `find_in_page` reaches the rest. Pages kept
// for the run, and in replay recordings, are cut to a bounded size.
const PAGE_OPENING_CHARS = 2000;
const MAX_PAGE_TEXT_CHARS = 100_000;
const FIND_PASSAGE_CHARS = 300;
const FIND_PASSAGES = 3;

const READ_PAGE_TOOL_DESCRIPTION =
  "Read the Bottle Reference source page or one promising public search result when the available excerpt does not expose the identity-critical fact. Returns the page's title, description, and opening text. The page stays available to `find_in_page` for the rest of this run, so use that to locate facts further down, such as ABV, age, cask, or bottling details. The page must agree with every confirmed decisive Bottle trait, or differ only on the uncertain trait being resolved; never use a confirmed conflicting sibling as Suggested Change evidence. One page-read allowance is reserved independently from search.";

const FIND_IN_PAGE_TOOL_DESCRIPTION =
  "Find an exact word, number, or short phrase in a page already read in this run, and return the passages around it. It reads nothing new from the web. Use specific terms for the fact you need, such as `%`, `cask`, `bottled`, `aged`, or a code from the label.";

const REFUSED_READS = {
  invalid_url: "This address is not a public web page",
  not_public: "This address is not a public web page",
  robots_disallowed:
    "The website's robots.txt does not allow reading this page",
  robots_unavailable:
    "The website's robots.txt could not be read, so the page was not read",
  login_required: "This page needs a login",
} satisfies Record<Extract<PageRead, { status: "refused" }>["reason"], string>;

/** Reads one page as markdown through PeatedBot. */
export async function runReadPage({
  web,
  url,
}: {
  web: BottleClassifierWeb;
  url: string;
}): Promise<{ page: BottleWebPage } | { error: string }> {
  const read = await web.readPage({ url, format: "markdown" });
  if (read.status === "refused") {
    return { error: REFUSED_READS[read.reason] };
  }
  if (read.status === "failed") {
    return {
      error: `Page read failed (${read.reason}${read.httpStatus ? `, ${read.httpStatus}` : ""})`,
    };
  }
  return {
    page: {
      url: canonicalizeWebEvidenceUrl(url),
      title: read.title,
      description: read.description,
      text: read.content.trim().slice(0, MAX_PAGE_TEXT_CHARS),
    },
  };
}

function pageResult(page: BottleWebPage) {
  return {
    title: page.title?.trim() || page.url,
    url: page.url,
    domain: getResultDomain(page.url),
    description: page.description?.trim() || null,
    extraSnippets: [],
  };
}

/** The evidence the model sees for a read: the page's opening text. */
export function buildPageOpeningEvidence(
  page: BottleWebPage,
): BottleSearchEvidence {
  return BottleSearchEvidenceSchema.parse({
    provider: "firecrawl",
    query: "page opening",
    summary: page.text.slice(0, PAGE_OPENING_CHARS) || null,
    results: [pageResult(page)],
  });
}

/**
 * Passages around each match of `query` in the page, ignoring case. Each
 * passage is centred on its match and passages never overlap.
 */
export function findPagePassages(text: string, query: string) {
  const haystack = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  const passages: string[] = [];
  let from = 0;
  while (passages.length < FIND_PASSAGES) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    const start = Math.max(
      0,
      index - Math.floor((FIND_PASSAGE_CHARS - needle.length) / 2),
    );
    const end = Math.min(text.length, start + FIND_PASSAGE_CHARS);
    passages.push(text.slice(start, end).replace(/\s+/g, " ").trim());
    from = end;
  }
  return passages;
}

/** Stores a read page for the run and returns the evidence the model sees. */
export function keepReadPage(
  budget: BottleWebSearchBudget,
  result: BottleWebToolResult,
): BottleWebToolResult {
  if (!("page" in result)) return result;
  budget.pages.set(result.page.url, result.page);
  return buildPageOpeningEvidence(result.page);
}

export function createReadPageTools({
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
  const readPage = strictAgentTool({
    name: "read_page",
    description: READ_PAGE_TOOL_DESCRIPTION,
    parameters: BottleWebReadPageArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "read_page",
        description: READ_PAGE_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          const result = keepReadPage(
            budget,
            await executeBottleWebSearchInvocation({
              budget,
              toolName: "read_page",
              args,
              execute: async () => await runReadPage({ web, url: args.url }),
              executeWebSearch,
            }),
          );
          const evidence = BottleSearchEvidenceSchema.safeParse(result);
          if (evidence.success) onEvidence?.(evidence.data);
          return result;
        },
      });
    },
  });

  const findInPage = strictAgentTool({
    name: "find_in_page",
    description: FIND_IN_PAGE_TOOL_DESCRIPTION,
    parameters: BottleWebFindInPageArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "find_in_page",
        description: FIND_IN_PAGE_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          const page = budget.pages.get(canonicalizeWebEvidenceUrl(args.url));
          if (!page) {
            return { error: "Read this page with read_page first" };
          }
          if (!budget.tryConsumePageFind()) {
            return budget.getExhaustedError("page_find");
          }
          const passages = findPagePassages(page.text, args.query);
          // A miss is not search evidence. It has no `query` field, so the
          // run's evidence merge cannot parse it as an empty evidence record.
          if (passages.length === 0) {
            return {
              url: page.url,
              message: `"${args.query}" is not on this page`,
            };
          }
          const evidence = BottleSearchEvidenceSchema.parse({
            provider: "firecrawl",
            query: args.query,
            summary: passages.join(" … "),
            results: [pageResult(page)],
          });
          onEvidence?.(evidence);
          return evidence;
        },
      });
    },
  });

  return [readPage, findInPage];
}
