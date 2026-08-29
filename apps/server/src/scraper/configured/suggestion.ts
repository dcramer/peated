import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { scrapeSources } from "@peated/server/db/schema";
import { createOpenAIAgentClient } from "@peated/server/lib/openaiClient";
import type { Currency } from "@peated/server/types";
import { eq } from "drizzle-orm";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseInput,
  Tool,
} from "openai/resources/responses/responses";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import type { ScrapeRules } from "./rules";
import { createScrapeSourceRevision } from "./service";
import {
  AI_INSTRUCTIONS_VERSION,
  MAX_SUGGESTION_DETAIL_PAGES,
  runScrapeSourceSetupAgent,
  type AiPage,
} from "./setupAgent";
import { ScrapeSourceSetupError } from "./setupError";

type SelectedListPage = AiPage & {
  links: string[];
  firstPageLinks: string[];
  nextPageUrl: string | null;
  nextPage: (AiPage & { links: string[]; nextPageUrl: string | null }) | null;
};
type CheckedDetailPage = AiPage & {
  output:
    | {
        kind: "review";
        title: string;
        publishedAt: string | null;
        reviews: Array<{
          name: string;
          reviewerName: string | null;
          nativeScore: {
            value: number;
            scale: number;
            display: string;
          } | null;
          reviewText: string | null;
        }>;
      }
    | {
        kind: "price";
        products: Array<{
          externalProductId: string | null;
          name: string;
          price: number;
          currency: Currency;
          volume: number;
          url: string;
          imageUrl: string | null;
          barcode: string | null;
        }>;
      };
};

export function checkListPage(input: {
  listPageUrl: string;
  rules: ScrapeRules;
  pages: AiPage[];
}): SelectedListPage {
  const selectedUrl = new URL(input.listPageUrl).toString();
  const selected = input.pages.find(
    (page) => new URL(page.url).toString() === selectedUrl,
  );
  if (!selected) {
    throw new ScrapeSourceSetupError(
      "The proposed list page was not one of the supplied pages.",
      [
        {
          field: "listPageUrl",
          message: "Choose the exact URL of one supplied list page.",
        },
      ],
    );
  }
  const result = parseScrapeList(
    input.rules,
    selected.html,
    new URL(selected.url),
  );
  if (result.links.length === 0 || result.issues.length > 0) {
    throw new ScrapeSourceSetupError(
      "The proposed rules did not read the selected list page.",
      result.issues.length > 0
        ? result.issues
        : [
            {
              field: "list.detailLink",
              message: "The selector did not find any detail links.",
            },
          ],
    );
  }
  return {
    ...selected,
    links: result.links,
    firstPageLinks: result.links,
    nextPageUrl: result.nextPageUrl,
    nextPage: null,
  };
}

export async function checkNextListPage(input: {
  rules: ScrapeRules;
  listPage: SelectedListPage;
  loadPage: (url: URL) => Promise<AiPage>;
}): Promise<SelectedListPage> {
  if (!input.listPage.nextPageUrl) return input.listPage;
  if (input.listPage.nextPageUrl === input.listPage.url) {
    throw new ScrapeSourceSetupError(
      "The proposed next page repeats the list page.",
      [
        {
          field: "list.nextPage",
          message: "Select a link to a different list page.",
        },
      ],
    );
  }
  const page = await input.loadPage(new URL(input.listPage.nextPageUrl));
  const result = parseScrapeList(input.rules, page.html, new URL(page.url));
  if (result.issues.length > 0) {
    throw new ScrapeSourceSetupError(
      "The proposed rules did not read the next list page.",
      result.issues,
    );
  }
  const links = new Set(input.listPage.links);
  const firstPageLinkCount = links.size;
  for (const link of result.links) links.add(link);
  if (links.size === firstPageLinkCount) {
    throw new ScrapeSourceSetupError(
      "The proposed next page did not add any detail pages.",
      [
        {
          field: "list.nextPage",
          message: "Select the link to the next page of results.",
        },
      ],
    );
  }
  return {
    ...input.listPage,
    links: [...links],
    nextPage: {
      ...page,
      links: result.links,
      nextPageUrl: result.nextPageUrl,
    },
  };
}

function parseDetailPage(rules: ScrapeRules, page: AiPage): CheckedDetailPage {
  const parsed = parseScrapeDetail(rules, page.html, new URL(page.url));
  if (parsed.issues.length > 0 || !parsed.value) {
    throw new ScrapeSourceSetupError(
      "The proposed rules did not read a detail page.",
      parsed.issues,
    );
  }
  if (parsed.kind === "review") {
    const value = parsed.value;
    return {
      ...page,
      output: {
        kind: "review",
        title: value.article.title,
        publishedAt: value.article.publishedAt?.toISOString() ?? null,
        reviews: value.article.externalReviews.map((review) => ({
          name: review.name,
          reviewerName: review.reviewerName ?? null,
          nativeScore: review.nativeScore ?? null,
          reviewText: value.externalReviewTexts[review.sourceKey] ?? null,
        })),
      },
    };
  }
  return {
    ...page,
    output: {
      kind: "price",
      products: parsed.value.map((product) => ({
        externalProductId: product.externalProductId ?? null,
        name: product.name,
        price: product.price,
        currency: product.currency,
        volume: product.volume,
        url: product.url,
        imageUrl: product.imageUrl ?? null,
        barcode: product.barcode ?? null,
      })),
    },
  };
}

export async function checkDetailPages(input: {
  rules: ScrapeRules;
  listPage: SelectedListPage;
  suppliedPages: AiPage[];
  loadPage: (url: URL) => Promise<AiPage>;
}): Promise<CheckedDetailPage[]> {
  const suppliedPages = new Map(
    input.suppliedPages.map((page) => [new URL(page.url).toString(), page]),
  );
  const pages: CheckedDetailPage[] = [];
  for (const link of input.listPage.links.slice(
    0,
    MAX_SUGGESTION_DETAIL_PAGES,
  )) {
    const page =
      suppliedPages.get(link) ?? (await input.loadPage(new URL(link)));
    pages.push(parseDetailPage(input.rules, page));
  }
  if (pages.length === 0) {
    throw new ScrapeSourceSetupError(
      "The proposed rules did not find a detail page.",
      [
        {
          field: "list.detailLink",
          message: "The selector did not find a usable detail page.",
        },
      ],
    );
  }
  return pages;
}

async function loadAiSource(scrapeSourceId: number) {
  // Confirm the source still exists immediately before each AI request.
  const [source] = await db
    .select({
      kind: scrapeSources.kind,
    })
    .from(scrapeSources)
    .where(eq(scrapeSources.id, scrapeSourceId));
  if (!source) throw new Error("Scrape source not found.");
  return source;
}

/** Keeps provider storage off and records complete public-site model calls. */
async function requestAi(input: {
  model: string;
  instructions: string;
  request: ResponseInput;
  tools?: Tool[];
  maxOutputTokens: number;
}) {
  const client = createOpenAIAgentClient({ workload: "scraper" });
  const request: ResponseCreateParamsNonStreaming = {
    model: input.model,
    instructions: input.instructions,
    input: input.request,
    max_output_tokens: input.maxOutputTokens,
    store: false,
  };
  if (input.tools) {
    request.include = ["reasoning.encrypted_content"];
    request.parallel_tool_calls = false;
    request.tool_choice = "required";
    request.tools = input.tools;
  }
  return await client.responses.create(request);
}

/** Creates an inactive revision only after the production parser accepts it. */
export async function suggestScrapeSourceRevision(input: {
  scrapeSourceId: number;
  externalSiteRunId: number;
  createdById: number;
  listPages: AiPage[];
  detailPages: AiPage[];
  loadPage: (url: URL) => Promise<AiPage>;
}) {
  const source = await loadAiSource(input.scrapeSourceId);
  const pageCache = new Map(
    [...input.listPages, ...input.detailPages].map((page) => [
      new URL(page.url).toString(),
      page,
    ]),
  );
  const setup = await runScrapeSourceSetupAgent({
    conversationId: `scrape_source:${input.scrapeSourceId}`,
    externalSiteRunId: input.externalSiteRunId,
    kind: source.kind,
    scrapeSourceId: input.scrapeSourceId,
    listPages: input.listPages,
    detailPages: input.detailPages,
    request: async (request) => {
      await loadAiSource(input.scrapeSourceId);
      return await requestAi({
        model: config.SCRAPER_SETUP_MODEL,
        instructions: request.instructions,
        request: request.input,
        tools: request.tools,
        maxOutputTokens: 8_000,
      });
    },
    checkRules: async (candidate) => {
      const inspectedPages: AiPage[] = [];
      const loadPage = async (url: URL) => {
        const key = url.toString();
        const cached = pageCache.get(key);
        if (cached) return cached;
        const page = await input.loadPage(url);
        pageCache.set(new URL(page.url).toString(), page);
        inspectedPages.push(page);
        return page;
      };
      try {
        const firstListPage = checkListPage({
          listPageUrl: candidate.listPageUrl,
          rules: candidate.rules,
          pages: input.listPages,
        });
        const listPage = await checkNextListPage({
          rules: candidate.rules,
          listPage: firstListPage,
          loadPage,
        });
        const detailPages = await checkDetailPages({
          rules: candidate.rules,
          listPage,
          suppliedPages: [...pageCache.values()],
          loadPage,
        });
        return {
          status: "passed" as const,
          checked: { listPage, detailPages },
        };
      } catch (error) {
        if (!(error instanceof ScrapeSourceSetupError)) throw error;
        return {
          status: "failed" as const,
          feedback: error.feedback(),
          inspectedPages,
        };
      }
    },
  });
  const suggestedRules = setup.rules;
  const listPage = setup.checked.listPage;
  return await createScrapeSourceRevision({
    scrapeSourceId: input.scrapeSourceId,
    listUrl: listPage.url,
    rules: suggestedRules,
    author: "ai",
    createdById: input.createdById,
    aiModel: setup.model,
    aiInstructionsVersion: AI_INSTRUCTIONS_VERSION,
  });
}
