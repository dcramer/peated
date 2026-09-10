import type { BottleExtractedDetails } from "@peated/bottle-classifier/contract";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { scrapeSourceRevisions, scrapeSources } from "@peated/server/db/schema";
import { createOpenAIAgentClient } from "@peated/server/lib/openaiClient";
import type { Currency } from "@peated/server/types";
import { and, eq } from "drizzle-orm";
import {
  loadExecutableScrapeRules,
  type ExecutableScrapeRules,
} from "./compatibility";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import type { ScrapeIssue, ScrapeSourcePreviewResult } from "./preview";
import type { ScrapeRules } from "./rules";
import { reserveScrapeSourceModelCall } from "./runs";
import { saveScrapeSourceSuggestion } from "./service";
import {
  AI_INSTRUCTIONS_VERSION,
  runScrapeSourceSetupAgent,
  type SetupAgentModelRequest,
  type SetupAgentModelResponse,
  type WebsitePage,
} from "./setupAgent";
import { ScrapeSourceSetupError } from "./setupError";

type SelectedListPage = WebsitePage & {
  links: string[];
  firstPageLinks: string[];
  nextPageUrl: string | null;
  nextPage:
    | (WebsitePage & { links: string[]; nextPageUrl: string | null })
    | null;
};
type CheckedDetailPage = WebsitePage & {
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
          body: string | null;
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
      }
    | {
        kind: "catalog";
        products: Array<{
          externalProductId: string | null;
          name: string;
          url: string;
          imageUrl: string | null;
          volume: number | null;
          sourceBottleIdentity: BottleExtractedDetails | null;
        }>;
      };
};

export function checkListPage(input: {
  listPageUrl: string;
  rules: ScrapeRules;
  pages: WebsitePage[];
}): SelectedListPage {
  const selectedUrl = new URL(input.listPageUrl).toString();
  const selected = input.pages.find(
    (page) => new URL(page.url).toString() === selectedUrl,
  );
  if (!selected) {
    throw new ScrapeSourceSetupError(
      "The chosen list page was not one of the given pages.",
      [
        {
          field: "listPageUrl",
          message: "Choose the exact URL of one given list page.",
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
      "The rules did not read the chosen list page.",
      result.issues.length > 0
        ? result.issues
        : [
            {
              field: "list.links",
              message: "The selector did not find any page links.",
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

export function checkPreviousListPage(input: {
  listPage: SelectedListPage;
  previousRules: Pick<ExecutableScrapeRules, "parseList">;
}) {
  const previous = input.previousRules.parseList(
    input.listPage.html,
    new URL(input.listPage.url),
  );
  if (previous.issues.length > 0) return;

  const previousLinks = new Set(previous.links);
  const proposedLinks = new Set(input.listPage.firstPageLinks);
  const unexpected = input.listPage.firstPageLinks.filter(
    (url) => !previousLinks.has(url),
  );
  const missing = previous.links.filter((url) => !proposedLinks.has(url));
  if (unexpected.length === 0 && missing.length === 0) return;

  const changes = [
    unexpected.length > 0
      ? `${unexpected.length} previously excluded page${unexpected.length === 1 ? "" : "s"} included`
      : null,
    missing.length > 0
      ? `${missing.length} previously included page${missing.length === 1 ? "" : "s"} missing`
      : null,
  ].filter(Boolean);
  throw new ScrapeSourceSetupError(
    "The rules changed which pages the working setup includes.",
    [
      {
        field: "list.links",
        message: `Preserve the previousSetup list filters: ${changes.join(", ")}.`,
      },
    ],
  );
}

export async function checkNextListPage(input: {
  rules: ScrapeRules;
  listPage: SelectedListPage;
  loadPage: (url: URL) => Promise<WebsitePage>;
}): Promise<SelectedListPage> {
  if (!input.listPage.nextPageUrl) return input.listPage;
  if (input.listPage.nextPageUrl === input.listPage.url) {
    throw new ScrapeSourceSetupError("The next page repeats the list page.", [
      {
        field: "list.nextPage",
        message: "Select a link to a different list page.",
      },
    ]);
  }
  const page = await input.loadPage(new URL(input.listPage.nextPageUrl));
  const result = parseScrapeList(input.rules, page.html, new URL(page.url));
  if (result.issues.length > 0) {
    throw new ScrapeSourceSetupError(
      "The rules did not read the next list page.",
      result.issues,
    );
  }
  const links = new Set(input.listPage.links);
  const firstPageLinkCount = links.size;
  for (const link of result.links) links.add(link);
  if (links.size === firstPageLinkCount) {
    throw new ScrapeSourceSetupError(
      "The next page did not add any new pages.",
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

function parseDetailPage(
  rules: ScrapeRules,
  page: WebsitePage,
): CheckedDetailPage {
  const parsed = parseScrapeDetail(rules, page.html, new URL(page.url));
  if (parsed.issues.length > 0 || !parsed.value) {
    throw new ScrapeSourceSetupError(
      "The rules did not read an article or product page.",
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
          body:
            value.externalReviewBodies[review.sourceKey]?.slice(0, 50_000) ??
            null,
        })),
      },
    };
  }
  if (parsed.kind === "catalog") {
    return {
      ...page,
      output: {
        kind: "catalog",
        products: parsed.value.map((product) => ({
          externalProductId: product.externalProductId ?? null,
          name: product.name,
          url: product.url,
          imageUrl: product.imageUrl ?? null,
          volume: product.volume ?? null,
          sourceBottleIdentity: product.sourceBottleIdentity ?? null,
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
  suppliedPages: WebsitePage[];
  loadPage: (url: URL) => Promise<WebsitePage>;
  onCheckPage?: (page: WebsitePage) => void;
}): Promise<CheckedDetailPage[]> {
  const suppliedPages = new Map(
    input.suppliedPages.map((page) => [new URL(page.url).toString(), page]),
  );
  const pages: CheckedDetailPage[] = [];
  for (const link of input.listPage.links) {
    const page =
      suppliedPages.get(link) ?? (await input.loadPage(new URL(link)));
    input.onCheckPage?.(page);
    pages.push(parseDetailPage(input.rules, page));
  }
  if (pages.length === 0) {
    throw new ScrapeSourceSetupError(
      "The rules did not find an article or product page.",
      [
        {
          field: "list.links",
          message: "The selector did not find a usable page.",
        },
      ],
    );
  }
  return pages;
}

function createCheckedPreview(
  detailPages: CheckedDetailPage[],
): ScrapeSourcePreviewResult {
  return {
    issues: [],
    pages: detailPages.map((page) => {
      if (page.output.kind === "review") {
        return {
          kind: "review",
          url: page.url,
          title: page.output.title,
          publishedAt: page.output.publishedAt,
          reviews: page.output.reviews.map((review) => ({
            name: review.name,
            reviewerName: review.reviewerName,
            nativeScore: review.nativeScore,
          })),
        };
      }
      return { ...page.output, url: page.url };
    }),
  };
}

async function loadAiSource(scrapeSourceId: number) {
  // Confirm the source still exists immediately before each AI request.
  const [source] = await db
    .select({
      kind: scrapeSources.kind,
      previousListPageUrl: scrapeSourceRevisions.listUrl,
      previousRulesVersion: scrapeSourceRevisions.rulesVersion,
      previousRules: scrapeSourceRevisions.rules,
      previousPreviewResult: scrapeSourceRevisions.previewResult,
    })
    .from(scrapeSources)
    .leftJoin(
      scrapeSourceRevisions,
      and(
        eq(scrapeSourceRevisions.scrapeSourceId, scrapeSources.id),
        eq(scrapeSourceRevisions.active, true),
      ),
    )
    .where(eq(scrapeSources.id, scrapeSourceId));
  if (!source) throw new Error("Scrape source not found.");
  return source;
}

export type RequestScrapeSourceModel = (
  request: SetupAgentModelRequest,
) => Promise<SetupAgentModelResponse>;

/** Keeps provider storage off and records complete public-site model calls. */
async function requestAi(input: SetupAgentModelRequest) {
  const client = createOpenAIAgentClient({ workload: "scraper" });
  return await client.responses.create({
    model: config.SCRAPER_SETUP_MODEL,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: 8_000,
    store: false,
    include: ["reasoning.encrypted_content"],
    parallel_tool_calls: false,
    tool_choice: "required",
    tools: input.tools,
  });
}

/** Saves a checked version without replacing the active version. */
export async function suggestScrapeSourceRevision(
  input: {
    scrapeSourceId: number;
    externalSiteRunId: number;
    executionToken: string;
    createdById?: number;
    listPages: WebsitePage[];
    detailPages: WebsitePage[];
    failure?: WebsitePage & { issues: ScrapeIssue[] };
    loadPage: (url: URL) => Promise<WebsitePage>;
  },
  requestModel: RequestScrapeSourceModel = requestAi,
) {
  const source = await loadAiSource(input.scrapeSourceId);
  let previousRules: ExecutableScrapeRules | null = null;
  if (source.previousRulesVersion && source.previousRules) {
    try {
      previousRules = loadExecutableScrapeRules(
        source.previousRulesVersion,
        source.previousRules,
      );
    } catch {
      // Invalid legacy rules must not block the suggestion that replaces them.
    }
  }
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
    failure: input.failure,
    previousSetup:
      source.previousListPageUrl &&
      source.previousRulesVersion &&
      source.previousRules
        ? {
            listPageUrl: source.previousListPageUrl,
            rulesVersion: source.previousRulesVersion,
            rules: source.previousRules,
            matchedPageUrls:
              source.previousPreviewResult?.pages.map((page) => page.url) ?? [],
          }
        : undefined,
    request: async (request) => {
      await loadAiSource(input.scrapeSourceId);
      await reserveScrapeSourceModelCall(
        input.externalSiteRunId,
        input.executionToken,
      );
      return await requestModel(request);
    },
    checkRules: async (submittedRules) => {
      const checkedPages = new Map<string, WebsitePage>();
      const rememberCheckedPage = (page: WebsitePage) => {
        checkedPages.set(new URL(page.url).toString(), page);
      };
      const loadPage = async (url: URL) => {
        const key = url.toString();
        const cached = pageCache.get(key);
        const page = cached ?? (await input.loadPage(url));
        if (!cached) pageCache.set(new URL(page.url).toString(), page);
        rememberCheckedPage(page);
        return page;
      };
      try {
        const selectedListPage = input.listPages.find(
          (page) =>
            new URL(page.url).toString() ===
            new URL(submittedRules.listPageUrl).toString(),
        );
        if (selectedListPage) rememberCheckedPage(selectedListPage);
        const firstListPage = checkListPage({
          listPageUrl: submittedRules.listPageUrl,
          rules: submittedRules.rules,
          pages: input.listPages,
        });
        if (
          previousRules &&
          source.previousListPageUrl &&
          new URL(source.previousListPageUrl).toString() === firstListPage.url
        ) {
          checkPreviousListPage({ listPage: firstListPage, previousRules });
        }
        const listPage = await checkNextListPage({
          rules: submittedRules.rules,
          listPage: firstListPage,
          loadPage,
        });
        const detailPages = await checkDetailPages({
          rules: submittedRules.rules,
          listPage,
          suppliedPages: [...pageCache.values()],
          loadPage,
          onCheckPage: rememberCheckedPage,
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
          inspectedPages: [...checkedPages.values()],
        };
      }
    },
  });
  const suggestedRules = setup.rules;
  const listPage = setup.checked.listPage;
  return await saveScrapeSourceSuggestion({
    scrapeSourceId: input.scrapeSourceId,
    externalSiteRunId: input.externalSiteRunId,
    executionToken: input.executionToken,
    listUrl: listPage.url,
    rules: suggestedRules,
    author: "ai",
    createdById: input.createdById,
    aiModel: setup.model,
    aiInstructionsVersion: AI_INSTRUCTIONS_VERSION,
    previewResult: createCheckedPreview(setup.checked.detailPages),
  });
}
