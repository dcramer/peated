import { RunContext } from "@openai/agents";
import type { PageRead, WebSearch } from "@peated/bot";
import { describe, expect, test, vi } from "vitest";
import { createReadPageTools } from "./readPage";
import {
  buildBottleSearchEvidence,
  createBottleWebSearchBudget,
  type BottleClassifierWeb,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";
import { createWebSearchTool, runWebSearch } from "./webSearch";

const runContext = new RunContext();

/** A fake PeatedBot that answers from fixed pages and search results. */
function createWeb({
  pages = {},
  search = () => ({ status: "ok", results: [] }),
}: {
  pages?: Record<string, PageRead>;
  search?: (query: string) => WebSearch;
} = {}) {
  const reads: string[] = [];
  const searches: Array<{ query: string; limit?: number }> = [];
  const web: BottleClassifierWeb = {
    readPage: async ({ url }) => {
      reads.push(url);
      return (
        pages[url] ?? {
          status: "failed",
          url,
          reason: "not_found",
          httpStatus: 404,
        }
      );
    },
    searchWeb: async (input) => {
      searches.push(input);
      return search(input.query);
    },
  };
  return { web, reads, searches };
}

function okPage(url: string, content: string, title = "Page"): PageRead {
  return {
    status: "ok",
    url,
    title,
    description: "A product page.",
    publishedTime: null,
    content,
    route: "firecrawl",
  };
}

function searchResults(...urls: string[]): WebSearch {
  return {
    status: "ok",
    results: urls.map((url) => ({
      url,
      title: `Result for ${url}`,
      description: `Evidence at ${url}`,
    })),
  };
}

describe("web_search", () => {
  test("removes tracking parameters from collected evidence URLs", () => {
    const evidence = buildBottleSearchEvidence({
      provider: "firecrawl",
      query: "example bottle",
      summary: null,
      results: [
        {
          title: "Example Bottle",
          url: "https://example.com/bottle?srsltid=search&utm_source=google#details",
          domain: "example.com",
          description: null,
          extraSnippets: [],
        },
      ],
    });

    expect(evidence.results[0]?.url).toBe("https://example.com/bottle");
  });

  test("searches through PeatedBot and keeps results compact", async () => {
    const { web, searches } = createWeb({
      search: () =>
        searchResults("https://www.whiskyadvocate.com/example-private-cask"),
    });

    const evidence = await runWebSearch({
      web,
      query: "example distillery private cask",
    });

    expect(searches).toEqual([
      { query: "example distillery private cask", limit: 8 },
    ]);
    expect(evidence).toMatchObject({
      provider: "firecrawl",
      query: "example distillery private cask",
      summary: expect.stringContaining("Evidence at"),
      results: [
        expect.objectContaining({
          domain: "whiskyadvocate.com",
          extraSnippets: [],
        }),
      ],
    });
  });

  test("reports a failed search as an error, not empty evidence", async () => {
    const { web } = createWeb({
      search: () => ({
        status: "failed",
        reason: "service_unavailable",
        httpStatus: 402,
      }),
    });

    await expect(runWebSearch({ web, query: "q" })).resolves.toEqual({
      error: "Web search failed (402)",
    });
  });

  test("replays searches through the shared execution boundary", async () => {
    const evidence = buildBottleSearchEvidence({
      provider: "firecrawl",
      query: "laphroaig cairdeas 2022 warehouse 1",
      summary: "Laphroaig confirms the 2022 Warehouse 1 release.",
      results: [
        {
          title: "Càirdeas 2022 Warehouse 1 Whisky",
          url: "https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky",
          domain: "laphroaig.com",
          description: null,
          extraSnippets: [],
        },
      ],
    });
    const executeWebSearch: BottleWebSearchExecutor = vi.fn(async () => ({
      evidence: [evidence],
      errors: [],
    }));
    const onEvidence = vi.fn();
    const tool = createWebSearchTool({
      web: createWeb().web,
      budget: createBottleWebSearchBudget(1),
      executeWebSearch,
      onEvidence,
    });

    await tool.invoke(
      runContext,
      JSON.stringify({ queries: ["laphroaig cairdeas 2022 warehouse 1"] }),
    );

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "web_search",
        args: { queries: ["laphroaig cairdeas 2022 warehouse 1"] },
        execute: expect.any(Function),
      }),
    );
    expect(onEvidence).toHaveBeenCalledOnce();
    expect(onEvidence).toHaveBeenCalledWith(evidence);
  });

  test("charges searches against the search-query budget, once", async () => {
    const { web, searches } = createWeb({
      search: () => searchResults("https://www.laphroaig.com/cairdeas"),
    });
    const tool = createWebSearchTool({
      web,
      budget: createBottleWebSearchBudget(1),
      executeWebSearch: async ({ execute }) => await execute(),
    });

    await tool.invoke(
      runContext,
      JSON.stringify({ queries: ["laphroaig cairdeas warehouse 1"] }),
    );
    await expect(
      tool.invoke(
        runContext,
        JSON.stringify({ queries: ["laphroaig cairdeas warehouse 1 again"] }),
      ),
    ).resolves.toEqual({ error: "Web search budget exhausted after 1 query" });
    expect(searches).toHaveLength(1);
  });

  test("runs up to two focused searches in one tool turn", async () => {
    const { web, searches } = createWeb({
      search: (query) =>
        searchResults(`https://example.com/${encodeURIComponent(query)}`),
    });
    const tool = createWebSearchTool({
      web,
      budget: createBottleWebSearchBudget(2),
    });

    const result = await tool.invoke(
      runContext,
      JSON.stringify({
        queries: ["example cask 71", "example single cask 2019"],
      }),
    );

    expect(searches).toHaveLength(2);
    expect(result).toMatchObject({
      evidence: [
        { query: "example cask 71" },
        { query: "example single cask 2019" },
      ],
      errors: [],
    });
  });

  test("caps bottle search evidence payload size", () => {
    const decisiveFact = "The bottle has an 8-year age statement.";
    const evidence = buildBottleSearchEvidence({
      provider: "firecrawl",
      query: "ardbeg traigh bhan 19",
      summary: ["x".repeat(450), decisiveFact, "y".repeat(800)].join(" "),
      results: Array.from({ length: 12 }, (_, index) => ({
        title: `Result ${index + 1} ${"y".repeat(300)}`,
        url: `https://example.com/${index + 1}`,
        domain: "example.com",
        description: "z".repeat(400),
        extraSnippets: ["a".repeat(1500), "b".repeat(1500)],
      })),
    });

    expect(evidence.summary).toHaveLength(1200);
    expect(evidence.summary).toContain(decisiveFact);
    expect(evidence.results).toHaveLength(6);
    for (const result of evidence.results) {
      expect(result.title.length).toBeLessThanOrEqual(160);
      expect((result.description ?? "").length).toBeLessThanOrEqual(220);
      expect(result.extraSnippets.length).toBeLessThanOrEqual(1);
      expect((result.extraSnippets[0] ?? "").length).toBeLessThanOrEqual(1200);
    }
  });
});

describe("read_page and find_in_page", () => {
  const pageUrl = "https://example.com/pokeno-cask-71";
  const longPage = [
    "# Pōkeno Cask No. 71",
    "x".repeat(4000),
    "Distilled in 2019 and bottled at 55.8% ABV from a single ex-bourbon cask.",
  ].join("\n\n");

  function tools(
    pages: Record<string, PageRead>,
    budget = createBottleWebSearchBudget(1),
  ) {
    const fake = createWeb({ pages });
    const onEvidence = vi.fn();
    const [readPage, findInPage] = createReadPageTools({
      web: fake.web,
      budget,
      onEvidence,
    });
    return {
      ...fake,
      readPage: readPage!,
      findInPage: findInPage!,
      onEvidence,
    };
  }

  test("shows the page's opening and finds a fact further down without reading again", async () => {
    const { readPage, findInPage, reads, onEvidence } = tools({
      [pageUrl]: okPage(pageUrl, longPage, "Pōkeno Cask No. 71"),
    });

    const opening = await readPage.invoke(
      runContext,
      JSON.stringify({ url: pageUrl }),
    );
    expect(opening).toMatchObject({
      provider: "firecrawl",
      summary: expect.stringContaining("# Pōkeno Cask No. 71"),
      results: [
        expect.objectContaining({
          url: pageUrl,
          title: "Pōkeno Cask No. 71",
          description: "A product page.",
        }),
      ],
    });
    expect(JSON.stringify(opening)).not.toContain("55.8%");

    const found = await findInPage.invoke(
      runContext,
      JSON.stringify({ url: pageUrl, query: "55.8%" }),
    );
    expect(found).toMatchObject({
      query: "55.8%",
      summary: expect.stringContaining("bottled at 55.8% ABV"),
      results: [expect.objectContaining({ url: pageUrl })],
    });
    expect(reads).toEqual([pageUrl]);
    expect(onEvidence).toHaveBeenCalledTimes(2);
  });

  test("says when the term is not on the page and records no evidence", async () => {
    const { readPage, findInPage, onEvidence } = tools({
      [pageUrl]: okPage(pageUrl, longPage),
    });
    await readPage.invoke(runContext, JSON.stringify({ url: pageUrl }));

    await expect(
      findInPage.invoke(
        runContext,
        JSON.stringify({ url: pageUrl, query: "sherry" }),
      ),
    ).resolves.toEqual({
      url: pageUrl,
      message: '"sherry" is not on this page',
    });
    expect(onEvidence).toHaveBeenCalledTimes(1);
  });

  test("asks for a read before finding in a page", async () => {
    const { findInPage } = tools({});

    await expect(
      findInPage.invoke(
        runContext,
        JSON.stringify({ url: pageUrl, query: "cask" }),
      ),
    ).resolves.toEqual({ error: "Read this page with read_page first" });
  });

  test("limits finds per run", async () => {
    const { readPage, findInPage } = tools({
      [pageUrl]: okPage(pageUrl, longPage),
    });
    await readPage.invoke(runContext, JSON.stringify({ url: pageUrl }));
    const find = () =>
      findInPage.invoke(
        runContext,
        JSON.stringify({ url: pageUrl, query: "cask" }),
      );

    for (let index = 0; index < 6; index++) await find();

    await expect(find()).resolves.toEqual({
      error: "Find-in-page budget exhausted after 6 finds",
    });
  });

  test("tells the model why a page was not read", async () => {
    const { readPage } = tools({
      [pageUrl]: {
        status: "refused",
        url: pageUrl,
        reason: "robots_disallowed",
      },
    });

    await expect(
      readPage.invoke(runContext, JSON.stringify({ url: pageUrl })),
    ).resolves.toEqual({
      error: "The website's robots.txt does not allow reading this page",
    });
  });

  test("keeps a replayed page so find_in_page can search it", async () => {
    const executeWebSearch: BottleWebSearchExecutor = vi.fn(async () => ({
      page: {
        url: pageUrl,
        title: "Release No. 2",
        description: null,
        text: "The exact marketed edition is Release No. 2.",
      },
    }));
    const budget = createBottleWebSearchBudget(1);
    const [readPage, findInPage] = createReadPageTools({
      web: createWeb().web,
      budget,
      executeWebSearch,
    });

    await readPage!.invoke(runContext, JSON.stringify({ url: pageUrl }));

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "read_page",
        args: { url: pageUrl },
      }),
    );
    await expect(
      findInPage!.invoke(
        runContext,
        JSON.stringify({ url: pageUrl, query: "release no" }),
      ),
    ).resolves.toMatchObject({
      summary: "The exact marketed edition is Release No. 2.",
    });
  });

  test("reserves a page read after the search-query budget is spent", async () => {
    const budget = createBottleWebSearchBudget(1);
    const fake = createWeb({
      pages: {
        "https://www.douglaslaing.com/products/the-gauldrons-eclipse": okPage(
          "https://www.douglaslaing.com/products/the-gauldrons-eclipse",
          "The bottle is 52.9% ABV.",
        ),
      },
      search: () => searchResults("https://example.com/eclipse"),
    });
    const searchTool = createWebSearchTool({ web: fake.web, budget });
    const [readPage] = createReadPageTools({ web: fake.web, budget });

    await searchTool.invoke(
      runContext,
      JSON.stringify({ queries: ["the gauldrons eclipse 52.9"] }),
    );
    await expect(
      readPage!.invoke(
        runContext,
        JSON.stringify({
          url: "https://www.douglaslaing.com/products/the-gauldrons-eclipse",
        }),
      ),
    ).resolves.toMatchObject({ summary: "The bottle is 52.9% ABV." });
    await expect(
      readPage!.invoke(
        runContext,
        JSON.stringify({ url: "https://example.com/second-page" }),
      ),
    ).resolves.toEqual({
      error: "Web page-read budget exhausted after 1 page",
    });
    expect(fake.reads).toHaveLength(1);
  });
});
