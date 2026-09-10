import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { scrapeSourceRevisions, scrapeSources } from "@peated/server/db/schema";
import { createOpenAIAgentClient } from "@peated/server/lib/openaiClient";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ScraperHttpStatusError } from "../http";
import {
  loadExecutableScrapeRules,
  UnsupportedScrapeRulesVersionError,
  type ExecutableScrapeRules,
} from "./compatibility";
import {
  createScrapeSourceAdapter,
  ScrapeSourceParseError,
  type ConfiguredScrapeCursor,
} from "./crawl";
import { inspectSyndicationFeed } from "./discovery";
import type { ScrapeIssue, ScrapeSourcePreviewResult } from "./preview";
import { SCRAPE_RULES_VERSION, type ScrapeRules } from "./rules";
import {
  reserveScrapeSourceModelCall,
  saveScrapeSourceSetupState,
} from "./runs";
import { saveScrapeSourceSuggestion } from "./service";
import {
  AI_INSTRUCTIONS_VERSION,
  runScrapeSourceSetupAgent,
  type RuleTestResult,
  type SetupAgentModelRequest,
  type SetupAgentModelResponse,
  type SetupAgentState,
  type WebsitePage,
} from "./setupAgent";
import { ScrapeSourceSetupError } from "./setupError";

function checkPreviousListPage(input: {
  listPage: WebsitePage & { firstPageLinks: string[] };
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

/** Tests the collection crawler without calling its ingestion sink. */
export async function testScrapeRules(input: {
  listPageUrl: string;
  rules: ScrapeRules;
  cursor: ConfiguredScrapeCursor | null;
  checkpoint: (cursor: ConfiguredScrapeCursor) => Promise<void>;
  loadPage: (url: URL) => Promise<WebsitePage>;
  previousRules?: ExecutableScrapeRules | null;
  previousListPageUrl?: string | null;
  failureUrl?: string;
}): Promise<RuleTestResult> {
  const rules = loadExecutableScrapeRules(SCRAPE_RULES_VERSION, input.rules);
  const inspected = new Map<string, WebsitePage>();
  let cursor = input.cursor;
  let preview: ScrapeSourcePreviewResult = { issues: [], pages: [] };
  const loadPage = async (url: URL) => {
    const page = await input.loadPage(url);
    inspected.set(page.url, page);
    return page;
  };
  try {
    if (
      !cursor &&
      input.previousRules &&
      input.previousListPageUrl === input.listPageUrl
    ) {
      const page = await loadPage(new URL(input.listPageUrl));
      const parsed = rules.parseList(page.html, new URL(page.url));
      if (parsed.issues.length > 0) {
        throw new ScrapeSourceParseError(page.url, parsed.issues);
      }
      checkPreviousListPage({
        listPage: { ...page, firstPageLinks: parsed.links },
        previousRules: input.previousRules,
      });
    }
    const adapter = createScrapeSourceAdapter({
      targetKey: "rule-test",
      listUrl: input.listPageUrl,
      rules,
      purpose: "preview",
      recordPreview: async (result) => {
        preview = result.result;
      },
    });
    await adapter({
      cursor,
      session: {
        request: async ({ url }) => {
          const page = await loadPage(url);
          return {
            url: new URL(page.url),
            body: page.html,
            headers: {},
            status: 200,
          };
        },
        emit: async () => {
          throw new Error("Rule tests must not import data.");
        },
        checkpoint: async (value) => {
          cursor = value;
          await input.checkpoint(value);
        },
        remainingRequests: () => 0,
      },
    });
    const visitedPages = [
      ...(cursor?.listUrls ?? []),
      ...(cursor?.detailUrls ?? []),
    ];
    // Repair must exercise the failure, not pass by moving it outside the test crawl.
    if (
      input.failureUrl &&
      !visitedPages.includes(input.failureUrl) &&
      !preview.pages.some((page) => page.url === input.failureUrl)
    ) {
      throw new ScrapeSourceSetupError(
        "The test did not reach the page that failed. Preserve its coverage or ask an admin to review the source.",
        [{ field: "list.links", message: input.failureUrl }],
      );
    }
    if (preview.issues.length > 0) {
      throw new ScrapeSourceSetupError(
        "The crawler did not produce valid output.",
        preview.issues,
      );
    }
    return {
      status: "passed",
      preview,
      visitedPages,
      inspectedPages: [...inspected.values()],
    };
  } catch (error) {
    if (error instanceof ScrapeSourceParseError) {
      return {
        status: "failed",
        feedback: { message: error.message, issues: error.issues },
        inspectedPages: [...inspected.values()],
      };
    }
    if (!(error instanceof ScrapeSourceSetupError)) throw error;
    return {
      status: "failed",
      feedback: error.feedback(),
      inspectedPages: [...inspected.values()],
    };
  }
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

/** Saves only the exact tested version accepted by the setup agent. */
export async function suggestScrapeSourceRevision(
  input: {
    scrapeSourceId: number;
    externalSiteRunId: number;
    executionToken: string;
    createdById?: number;
    listPages: WebsitePage[];
    detailPages: WebsitePage[];
    failure?: WebsitePage & { issues: ScrapeIssue[] };
    failureUrl?: string;
    state?: SetupAgentState;
    allowedOrigins: string[];
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
    } catch (error) {
      // Scraper setup can replace unreadable rules; keep their raw context below.
      if (
        !(error instanceof z.ZodError) &&
        !(error instanceof UnsupportedScrapeRulesVersionError)
      ) {
        throw error;
      }
    }
  }
  const pageCache = new Map(
    [
      ...input.listPages,
      ...input.detailPages,
      ...(input.failure ? [input.failure] : []),
    ].map((page) => [new URL(page.url).toString(), page]),
  );
  const loadPage = async (url: URL) => {
    if (
      !input.allowedOrigins.includes(url.origin) ||
      url.username ||
      url.password
    ) {
      throw new ScrapeSourceSetupError(
        "Read pages only from this source's allowed website.",
      );
    }
    const cached = pageCache.get(url.toString());
    if (cached) return cached;
    let page: WebsitePage;
    try {
      page = await input.loadPage(url);
    } catch (error) {
      if (
        error instanceof ScraperHttpStatusError &&
        [404, 410].includes(error.status)
      ) {
        throw new ScrapeSourceSetupError(
          "That page is no longer available. Choose another link from the website.",
        );
      }
      throw error;
    }
    pageCache.set(url.toString(), page);
    pageCache.set(new URL(page.url).toString(), page);
    return page;
  };
  const setup = await runScrapeSourceSetupAgent({
    conversationId: `scrape_source:${input.scrapeSourceId}`,
    externalSiteRunId: input.externalSiteRunId,
    kind: source.kind,
    scrapeSourceId: input.scrapeSourceId,
    listPages: input.listPages,
    detailPages: input.detailPages,
    failure: input.failure,
    state: input.state,
    saveState: async (state) => {
      await saveScrapeSourceSetupState(
        input.externalSiteRunId,
        input.executionToken,
        state,
      );
    },
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
    readPage: async (url) => {
      const page = await loadPage(url);
      return {
        ...page,
        document: inspectSyndicationFeed({
          pageUrl: new URL(page.url),
          xml: page.html,
        })
          ? "xml"
          : "html",
      };
    },
    testRules: async (submitted, cursor, checkpoint) => {
      return await testScrapeRules({
        ...submitted,
        cursor,
        checkpoint,
        loadPage,
        previousRules,
        previousListPageUrl: source.previousListPageUrl,
        failureUrl: input.failureUrl ?? input.failure?.url,
      });
    },
  });
  return await saveScrapeSourceSuggestion({
    scrapeSourceId: input.scrapeSourceId,
    externalSiteRunId: input.externalSiteRunId,
    executionToken: input.executionToken,
    listUrl: setup.listPageUrl,
    rules: setup.rules,
    author: "ai",
    createdById: input.createdById,
    aiModel: setup.model,
    aiInstructionsVersion: AI_INSTRUCTIONS_VERSION,
    previewResult: setup.preview,
  });
}
