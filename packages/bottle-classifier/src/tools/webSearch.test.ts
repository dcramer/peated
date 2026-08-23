import { RunContext } from "@openai/agents";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  createFirecrawlReadPageTool,
  extractFirecrawlPageEvidence,
  runFirecrawlReadPage,
} from "./firecrawlReadPage";
import {
  createFirecrawlWebSearchTool,
  extractFirecrawlSearchEvidence,
  runFirecrawlWebSearch,
} from "./firecrawlWebSearch";
import {
  buildBottleSearchEvidence,
  createBottleWebSearchBudget,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";

const runContext = new RunContext();
const FirecrawlSearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number(),
  sources: z.array(z.string()),
});
const FirecrawlScrapeRequestSchema = z.object({
  formats: z.array(z.object({ type: z.string(), query: z.string() })),
  proxy: z.string(),
});

describe("bottleClassifier web search tool", () => {
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

  test("keeps Firecrawl search results compact until a page is selected", () => {
    const evidence = extractFirecrawlSearchEvidence(
      "example distillery private cask",
      {
        success: true,
        data: {
          web: [
            {
              title: "Example Private Cask Review",
              url: "https://www.whiskyadvocate.com/example-private-cask-review",
              description:
                "Whisky Advocate reviews Example Distillery Private Cask.",
              markdown:
                "# Example Private Cask\n\nA single cask bottling at 57.1% ABV.",
            },
          ],
        },
      },
    );

    expect(evidence).toMatchObject({
      provider: "firecrawl",
      query: "example distillery private cask",
      summary: expect.stringContaining("Whisky Advocate reviews"),
      results: [
        expect.objectContaining({
          title: "Example Private Cask Review",
          domain: "whiskyadvocate.com",
          extraSnippets: [],
        }),
      ],
    });
  });

  test("runs Firecrawl search against the v2 search endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          web: [
            {
              title: "Example Private Cask Review",
              url: "https://www.whiskyadvocate.com/example-private-cask-review",
              description:
                "Whisky Advocate reviews Example Distillery Private Cask.",
              markdown: "Example Distillery Private Cask is 57.1% ABV.",
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetch);

    try {
      const evidence = await runFirecrawlWebSearch({
        apiKey: "firecrawl-test-key",
        query: "example distillery private cask",
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        new URL("https://api.firecrawl.dev/v2/search"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer firecrawl-test-key",
          }),
          body: expect.stringContaining("example distillery private cask"),
        }),
      );
      const searchBody = FirecrawlSearchRequestSchema.parse(
        JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)),
      );
      expect(searchBody).toEqual({
        query: "example distillery private cask",
        limit: 5,
        sources: ["web"],
      });
      expect("error" in evidence).toBe(false);
      if ("error" in evidence) return;
      expect(evidence.results).toHaveLength(1);
      expect(evidence.summary).toContain("Whisky Advocate reviews");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("replays Firecrawl through the shared execution boundary", async () => {
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
    const tool = createFirecrawlWebSearchTool({
      apiKey: "firecrawl-test-key",
      budget: createBottleWebSearchBudget(1),
      executeWebSearch,
      onEvidence,
    });

    await tool.invoke(
      runContext,
      JSON.stringify({
        queries: ["laphroaig cairdeas 2022 warehouse 1"],
      }),
    );

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "firecrawl_web_search",
        args: { queries: ["laphroaig cairdeas 2022 warehouse 1"] },
        execute: expect.any(Function),
      }),
    );
    expect(onEvidence).toHaveBeenCalledOnce();
    expect(onEvidence).toHaveBeenCalledWith(evidence);
  });

  test("charges Firecrawl calls against the search-query budget", async () => {
    const evidence = buildBottleSearchEvidence({
      provider: "firecrawl",
      query: "laphroaig cairdeas 2022 warehouse 1",
      summary: "Laphroaig confirms the Warehouse 1 release.",
      results: [],
    });
    const executeWebSearch: BottleWebSearchExecutor = vi.fn(async () => ({
      evidence: [evidence],
      errors: [],
    }));
    const tool = createFirecrawlWebSearchTool({
      apiKey: "firecrawl-test-key",
      budget: createBottleWebSearchBudget(1),
      executeWebSearch,
    });
    const args = JSON.stringify({
      queries: ["laphroaig cairdeas 2022 warehouse 1"],
    });

    await tool.invoke(runContext, args);
    await expect(tool.invoke(runContext, args)).resolves.toEqual({
      error: "Web search budget exhausted after 1 query",
    });
    expect(executeWebSearch).toHaveBeenCalledOnce();
  });

  test("does not double-charge when a custom executor delegates live", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          web: [
            {
              title: "Càirdeas 2022 Warehouse 1 Whisky",
              url: "https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky",
              description: "Laphroaig confirms the Warehouse 1 release.",
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetch);

    try {
      const tool = createFirecrawlWebSearchTool({
        apiKey: "firecrawl-test-key",
        budget: createBottleWebSearchBudget(1),
        executeWebSearch: async ({ execute }) => await execute(),
      });

      await tool.invoke(
        runContext,
        JSON.stringify({ queries: ["laphroaig cairdeas warehouse 1"] }),
      );

      expect(fetch).toHaveBeenCalledOnce();
      await expect(
        tool.invoke(
          runContext,
          JSON.stringify({
            queries: ["laphroaig cairdeas warehouse 1 again"],
          }),
        ),
      ).resolves.toEqual({
        error: "Web search budget exhausted after 1 query",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("runs up to two focused searches in one tool turn", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async (_url, init: RequestInit) => {
        const requestBody = z.string().parse(init.body);
        const body = z
          .object({ query: z.string() })
          .parse(JSON.parse(requestBody));
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              web: [
                {
                  title: body.query,
                  url: `https://example.com/${encodeURIComponent(body.query)}`,
                  description: `Evidence for ${body.query}`,
                },
              ],
            },
          }),
        };
      });
    vi.stubGlobal("fetch", fetch);

    try {
      const tool = createFirecrawlWebSearchTool({
        apiKey: "firecrawl-test-key",
        budget: createBottleWebSearchBudget(2),
      });
      const result = await tool.invoke(
        runContext,
        JSON.stringify({
          queries: ["example cask 71", "example single cask 2019"],
        }),
      );

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        evidence: [
          { query: "example cask 71" },
          { query: "example single cask 2019" },
        ],
        errors: [],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("reads a promising Firecrawl result with a focused page excerpt", async () => {
    const pageUrl = "https://example.com/pokeno-cask-71";
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          highlights:
            "Cask No. 71 was distilled in 2019 and bottled at 55.8% ABV.",
          metadata: {
            title: "Pōkeno Cask No. 71",
            description: "A single-cask Pōkeno release.",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetch);

    try {
      const evidence = await runFirecrawlReadPage({
        apiKey: "firecrawl-test-key",
        url: pageUrl,
        focus: "Cask No. 71 vintage and ABV",
      });

      expect(fetch).toHaveBeenCalledWith(
        new URL("https://api.firecrawl.dev/v2/scrape"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(pageUrl),
        }),
      );
      const scrapeBody = FirecrawlScrapeRequestSchema.parse(
        JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)),
      );
      expect(scrapeBody.formats).toEqual([
        {
          type: "highlights",
          query: "Cask No. 71 vintage and ABV",
        },
      ]);
      expect(scrapeBody.proxy).toBe("basic");
      expect(evidence).toMatchObject({
        provider: "firecrawl",
        query: "Cask No. 71 vintage and ABV",
        summary: expect.stringContaining("distilled in 2019"),
        results: [expect.objectContaining({ url: pageUrl })],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("replays and hydrates a Firecrawl page read", async () => {
    const pageUrl = "https://example.com/release";
    const evidence = extractFirecrawlPageEvidence(pageUrl, "exact edition", {
      success: true,
      data: {
        markdown: "The exact marketed edition is Release No. 2.",
        metadata: { title: "Release No. 2" },
      },
    });
    const executeWebSearch: BottleWebSearchExecutor = vi.fn(
      async () => evidence,
    );
    const onEvidence = vi.fn();
    const tool = createFirecrawlReadPageTool({
      apiKey: "firecrawl-test-key",
      budget: createBottleWebSearchBudget(1),
      executeWebSearch,
      onEvidence,
    });

    await tool.invoke(
      runContext,
      JSON.stringify({ url: pageUrl, focus: "exact edition" }),
    );

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "firecrawl_read_page",
        args: { url: pageUrl, focus: "exact edition" },
        execute: expect.any(Function),
      }),
    );
    expect(onEvidence).toHaveBeenCalledWith(evidence);
  });

  test("reserves a page read after the search-query budget is spent", async () => {
    const budget = createBottleWebSearchBudget(1);
    const searchExecutor = vi.fn(async () => ({ evidence: [], errors: [] }));
    const readExecutor = vi.fn(async ({ args }) =>
      extractFirecrawlPageEvidence(
        "url" in args ? args.url : "https://example.com/bottle",
        "focus" in args ? args.focus : "identity",
        {
          success: true,
          data: { markdown: "The bottle is 52.9% ABV." },
        },
      ),
    );
    const searchTool = createFirecrawlWebSearchTool({
      apiKey: "firecrawl-test-key",
      budget,
      executeWebSearch: searchExecutor,
    });
    const readTool = createFirecrawlReadPageTool({
      apiKey: "firecrawl-test-key",
      budget,
      executeWebSearch: readExecutor,
    });

    await searchTool.invoke(
      runContext,
      JSON.stringify({ queries: ["the gauldrons eclipse 52.9"] }),
    );
    await expect(
      readTool.invoke(
        runContext,
        JSON.stringify({
          url: "https://www.douglaslaing.com/products/the-gauldrons-eclipse",
          focus: "ABV",
        }),
      ),
    ).resolves.toMatchObject({ summary: "The bottle is 52.9% ABV." });
    await expect(
      readTool.invoke(
        runContext,
        JSON.stringify({
          url: "https://example.com/second-page",
          focus: "release year",
        }),
      ),
    ).resolves.toEqual({
      error: "Web page-read budget exhausted after 1 page",
    });
    expect(searchExecutor).toHaveBeenCalledOnce();
    expect(readExecutor).toHaveBeenCalledOnce();
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
