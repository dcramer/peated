import { tool } from "@openai/agents";
import { findPagePassages, type PeatedBot } from "@peated/bot";
import { z } from "zod";
import {
  EntityClassificationSearchEvidenceSchema,
  type EntityClassificationSearchEvidence,
} from "../classifierTypes";
import { startToolSpan } from "../observability";

/** How the classifier reaches the web: PeatedBot's page reader and search. */
export type EntityClassifierWeb = Pick<PeatedBot, "readPage" | "searchWeb">;

export const MAX_PAGE_READS = 2;

// Finds search text already read, so they cost no web request; the limit only
// bounds the run's turns (agent design policy).
const MAX_PAGE_FINDS = 6;
const SEARCH_RESULT_LIMIT = 8;
const PAGE_OPENING_CHARS = 2000;
const MAX_PAGE_TEXT_CHARS = 100_000;

const WEB_SEARCH_TOOL_DESCRIPTION =
  "Search the live web for official producer naming, website, location, and branding evidence. Returns source URLs, titles, and short snippets. Prefer official sources and use this only when local entity evidence is still ambiguous.";
const READ_PAGE_TOOL_DESCRIPTION =
  "Read one promising public page, such as a producer's official website, when a snippet does not settle the fact. Returns the page's title, description, and opening text. The page stays available to `find_in_page` for the rest of this run.";
const FIND_IN_PAGE_TOOL_DESCRIPTION =
  "Find an exact word or short phrase in a page already read in this run, and return the passages around it. Use it for facts further down the page, such as `founded`, `distillery`, or a place name. It reads nothing new from the web.";

const WebSearchArgsSchema = z
  .object({ query: z.string().trim().min(1) })
  .strict();
const ReadPageArgsSchema = z.object({ url: z.string().trim().min(1) }).strict();
const FindInPageArgsSchema = z
  .object({
    url: z.string().trim().min(1),
    query: z.string().trim().min(2).max(80),
  })
  .strict();

type WebPage = {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
};

function getResultDomain(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function pageEvidence(
  page: WebPage,
  query: string,
  summary: string,
): EntityClassificationSearchEvidence {
  return EntityClassificationSearchEvidenceSchema.parse({
    provider: "firecrawl",
    query,
    summary: summary || null,
    results: [
      {
        title: page.title?.trim() || page.url,
        url: page.url,
        domain: getResultDomain(page.url),
        description: page.description?.trim() || null,
      },
    ],
  });
}

/**
 * The classifier's web tools, all through PeatedBot (blocked websites policy).
 * Evidence goes to `onEvidence`, so advice can only cite what the run saw.
 */
export function createWebTools({
  web,
  maxSearchQueries,
  onEvidence,
}: {
  web: EntityClassifierWeb;
  maxSearchQueries: number;
  onEvidence: (evidence: EntityClassificationSearchEvidence) => void;
}) {
  let remainingQueries = maxSearchQueries;
  let remainingReads = MAX_PAGE_READS;
  let remainingFinds = MAX_PAGE_FINDS;
  const pages = new Map<string, WebPage>();

  const webSearch = tool({
    name: "web_search",
    description: WEB_SEARCH_TOOL_DESCRIPTION,
    parameters: WebSearchArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "web_search",
        description: WEB_SEARCH_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          if (remainingQueries <= 0) {
            return { error: "Web search budget exhausted." };
          }
          remainingQueries -= 1;

          const search = await web.searchWeb({
            query: args.query,
            limit: SEARCH_RESULT_LIMIT,
          });
          if (search.status === "failed") {
            return { error: `Web search failed (${search.reason}).` };
          }
          const evidence = EntityClassificationSearchEvidenceSchema.parse({
            provider: "firecrawl",
            query: args.query,
            summary: null,
            results: search.results.map((result) => ({
              title: result.title,
              url: result.url,
              domain: getResultDomain(result.url),
              description: result.description,
            })),
          });
          onEvidence(evidence);
          return evidence;
        },
      });
    },
  });

  const readPage = tool({
    name: "read_page",
    description: READ_PAGE_TOOL_DESCRIPTION,
    parameters: ReadPageArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "read_page",
        description: READ_PAGE_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          if (remainingReads <= 0) {
            return { error: "Page read budget exhausted." };
          }
          remainingReads -= 1;

          const read = await web.readPage({
            url: args.url,
            format: "markdown",
          });
          if (read.status !== "ok") {
            return { error: `Page not read (${read.reason}).` };
          }
          const page = {
            url: read.url,
            title: read.title,
            description: read.description,
            text: read.content.trim().slice(0, MAX_PAGE_TEXT_CHARS),
          };
          // Redirects can change the address, and the model may use either.
          pages.set(args.url, page);
          pages.set(page.url, page);

          const evidence = pageEvidence(
            page,
            "page opening",
            page.text.slice(0, PAGE_OPENING_CHARS),
          );
          onEvidence(evidence);
          return evidence;
        },
      });
    },
  });

  const findInPage = tool({
    name: "find_in_page",
    description: FIND_IN_PAGE_TOOL_DESCRIPTION,
    parameters: FindInPageArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "find_in_page",
        description: FIND_IN_PAGE_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          const page = pages.get(args.url);
          if (!page) return { error: "Read this page with read_page first." };
          if (remainingFinds <= 0) {
            return { error: "Find-in-page budget exhausted." };
          }
          remainingFinds -= 1;

          const passages = findPagePassages(page.text, args.query);
          if (passages.length === 0) {
            return { message: `"${args.query}" is not on this page.` };
          }
          const evidence = pageEvidence(page, args.query, passages.join(" … "));
          onEvidence(evidence);
          return evidence;
        },
      });
    },
  });

  return [webSearch, readPage, findInPage];
}
