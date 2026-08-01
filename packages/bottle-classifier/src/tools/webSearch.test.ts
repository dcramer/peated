import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";
import {
  createFirecrawlWebSearchTool,
  extractFirecrawlSearchEvidence,
  runFirecrawlWebSearch,
} from "./firecrawlWebSearch";
import {
  buildOpenAIWebSearchRequest,
  createOpenAIWebSearchTool,
  extractOpenAISearchEvidence,
  runBottleWebEvidenceSearch,
} from "./openaiWebSearch";
import {
  buildBottleSearchEvidence,
  createBottleWebSearchBudget,
  isThinBottleSearchEvidence,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";

describe("bottleClassifier web search tools", () => {
  test("extracts OpenAI search evidence from web search call sources when citations are missing", () => {
    const evidence = extractOpenAISearchEvidence(
      "lagavulin distillers edition 2023",
      {
        output: [
          {
            type: "web_search_call",
            action: {
              type: "search",
              query: "lagavulin distillers edition 2023",
              sources: [
                {
                  type: "url",
                  url: "https://www.malts.com/en-row/products/lagavulin-distillers-edition-single-malt-scotch-whisky",
                },
                {
                  type: "url",
                  url: "https://www.whiskyadvocate.com/ratings-reviews/lagavulin-distillers-edition-2023/",
                },
              ],
            },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "OpenAI searched the web and found official plus independent references.",
                annotations: [],
              },
            ],
          },
        ],
      },
    );

    expect(evidence).toMatchObject({
      provider: "openai",
      query: "lagavulin distillers edition 2023",
      summary:
        "OpenAI searched the web and found official plus independent references.",
    });
    expect(evidence.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "malts.com",
          url: "https://www.malts.com/en-row/products/lagavulin-distillers-edition-single-malt-scotch-whisky",
        }),
        expect.objectContaining({
          domain: "whiskyadvocate.com",
          url: "https://www.whiskyadvocate.com/ratings-reviews/lagavulin-distillers-edition-2023/",
        }),
      ]),
    );
  });

  test("prefers citation titles while deduping against OpenAI web search call sources", () => {
    const evidence = extractOpenAISearchEvidence("wild turkey rare breed rye", {
      output_text: "Wild Turkey confirms Rare Breed Rye is barrel proof.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            query: "wild turkey rare breed rye",
            sources: [
              {
                type: "url",
                url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
              },
            ],
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
                  title: "Rare Breed Rye",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(evidence.results).toEqual([
      expect.objectContaining({
        title: "Rare Breed Rye",
        domain: "wildturkeybourbon.com",
        description: null,
      }),
    ]);
  });

  test("recovers and dedupes gateway Markdown citations before summary truncation", () => {
    const independentUrl =
      "https://www.whiskyadvocate.com/ratings-reviews/wild-turkey-rare-breed-rye/";
    const evidence = extractOpenAISearchEvidence("wild turkey rare breed rye", {
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            query: "wild turkey rare breed rye",
            sources: [
              {
                type: "url",
                url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
              },
            ],
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: [
                "Wild Turkey confirms Rare Breed Rye is barrel proof.",
                "x".repeat(650),
                "[Rare Breed Rye](https://www.wildturkeybourbon.com/products/rare-breed-rye/)",
                `[Whisky Advocate review](${independentUrl})`,
              ].join(" "),
              annotations: [],
            },
          ],
        },
      ],
    });

    expect(evidence.summary).toHaveLength(600);
    expect(evidence.results).toEqual([
      expect.objectContaining({
        title: "Rare Breed Rye",
        domain: "wildturkeybourbon.com",
        url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
      }),
      expect.objectContaining({
        title: "Whisky Advocate review",
        domain: "whiskyadvocate.com",
        url: independentUrl,
      }),
    ]);
  });

  test.each(["Markdown", "structured"] as const)(
    "prioritizes %s citations over uncited search sources",
    (citationFormat) => {
      const citedUrl =
        "https://www.whiskyadvocate.com/ratings-reviews/wild-turkey-rare-breed-rye/";
      const uncitedUrls = Array.from(
        { length: 7 },
        (_, index) => `https://search-source-${index + 1}.example/product`,
      );
      const content =
        citationFormat === "Markdown"
          ? {
              type: "output_text",
              text: `An independent [Whisky Advocate review](${citedUrl}) confirms the release.`,
              annotations: [],
            }
          : {
              type: "output_text",
              text: "An independent review confirms the release.",
              annotations: [
                {
                  type: "url_citation",
                  title: "Whisky Advocate review",
                  url: citedUrl,
                },
              ],
            };
      const evidence = extractOpenAISearchEvidence(
        "wild turkey rare breed rye",
        {
          output: [
            {
              type: "web_search_call",
              action: {
                type: "search",
                query: "wild turkey rare breed rye",
                sources: uncitedUrls.map((url) => ({ type: "url", url })),
              },
            },
            {
              type: "message",
              content: [content],
            },
          ],
        },
      );

      expect(evidence.results).toHaveLength(6);
      expect(evidence.results[0]).toMatchObject({
        title: "Whisky Advocate review",
        url: citedUrl,
      });
      expect(evidence.results.map(({ url }) => url)).not.toContain(
        uncitedUrls.at(-1),
      );
    },
  );

  test("does not duplicate the top-level summary into each OpenAI result description", () => {
    const evidence = extractOpenAISearchEvidence("jura 12 official", {
      output_text: "Jura confirms the 12-year-old core single malt bottling.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            query: "jura 12 official",
            sources: [
              {
                type: "url",
                url: "https://jurawhisky.com/products/12-year-old",
              },
              {
                type: "url",
                url: "https://www.masterofmalt.com/whiskies/jura/jura-12-year-old-whisky/",
              },
            ],
          },
        },
      ],
    });

    expect(evidence.summary).toBe(
      "Jura confirms the 12-year-old core single malt bottling.",
    );
    expect(evidence.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: null,
        }),
      ]),
    );
  });

  test("automatically supplements thin OpenAI evidence within the shared budget", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text:
          "Four Roses confirms [Single Barrel Barrel Strength](https://www.fourrosesbourbon.com/bourbon/single-barrel-barrel-strength/).",
        output: [],
      })
      .mockResolvedValueOnce({
        output_text:
          "Breaking Bourbon covers [Four Roses barrel strength private selections](https://www.breakingbourbon.com/review/four-roses-single-barrel-barrel-strength-private-selection).",
        output: [],
      });
    const client = {
      responses: {
        create,
      },
    } as unknown as OpenAI;

    const evidence = await runBottleWebEvidenceSearch({
      client,
      model: "gpt-5.4",
      query: "four roses single barrel barrel strength",
      budget: createBottleWebSearchBudget(2),
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect("error" in evidence).toBe(false);
    if ("error" in evidence) return;
    expect(evidence.results).toHaveLength(2);
    expect(isThinBottleSearchEvidence(evidence)).toBe(false);
    expect(evidence.summary).toContain("Four Roses confirms");
    expect(evidence.summary).toContain("Breaking Bourbon covers");
  });

  test("does not supplement gateway Markdown evidence from two domains", async () => {
    const primaryUrls = [
      "https://example-distillery.com/bottles/private-cask",
      "https://whisky.example/reviews/private-cask",
    ];
    const supplementalUrl =
      "https://another-review.example/bottles/private-cask";
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text: `Official [product details](${primaryUrls[0]}) agree with an [independent review](${primaryUrls[1]}).`,
        output: [],
      })
      .mockResolvedValueOnce({
        output_text: `Another [independent review](${supplementalUrl}) confirms the bottle.`,
        output: [],
      });
    const client = {
      responses: {
        create,
      },
    } as unknown as OpenAI;

    const evidence = await runBottleWebEvidenceSearch({
      client,
      model: "gpt-5.4",
      query: "example distillery private cask",
      budget: createBottleWebSearchBudget(2),
    });

    expect("error" in evidence).toBe(false);
    if ("error" in evidence) return;
    expect(evidence.results.map(({ url }) => url)).toEqual(primaryUrls);
    expect(isThinBottleSearchEvidence(evidence)).toBe(false);
  });

  test("extracts Firecrawl search evidence with scraped page markdown", () => {
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
      summary: expect.stringContaining("57.1% ABV"),
      results: [
        expect.objectContaining({
          title: "Example Private Cask Review",
          domain: "whiskyadvocate.com",
          extraSnippets: [expect.stringContaining("single cask bottling")],
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
      expect("error" in evidence).toBe(false);
      if ("error" in evidence) return;
      expect(evidence.results).toHaveLength(1);
      expect(evidence.summary).toContain("Whisky Advocate reviews");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("can replay either web search tool through one execution boundary", async () => {
    const evidence = buildBottleSearchEvidence({
      provider: "openai",
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
    const events: string[] = [];
    const executeWebSearch: BottleWebSearchExecutor = vi.fn(
      async ({ toolName }) => {
        events.push(`execute:${toolName}`);
        return evidence;
      },
    );
    const onOpenAIEvidence = vi.fn(() => events.push("hydrate:openai"));
    const onFirecrawlEvidence = vi.fn(() => events.push("hydrate:firecrawl"));
    const budget = createBottleWebSearchBudget(2);
    const openAITool = createOpenAIWebSearchTool({
      client: {} as OpenAI,
      model: "gpt-5.4",
      budget,
      executeWebSearch,
      onEvidence: onOpenAIEvidence,
    });
    const firecrawlTool = createFirecrawlWebSearchTool({
      apiKey: "firecrawl-test-key",
      budget,
      executeWebSearch,
      onEvidence: onFirecrawlEvidence,
    });
    const args = JSON.stringify({
      query: "laphroaig cairdeas 2022 warehouse 1",
    });

    await openAITool.invoke({} as never, args);
    await firecrawlTool.invoke({} as never, args);

    expect(executeWebSearch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        toolName: "openai_web_search",
        args: { query: "laphroaig cairdeas 2022 warehouse 1" },
        execute: expect.any(Function),
      }),
    );
    expect(executeWebSearch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        toolName: "firecrawl_web_search",
        args: { query: "laphroaig cairdeas 2022 warehouse 1" },
        execute: expect.any(Function),
      }),
    );
    expect(onOpenAIEvidence).toHaveBeenCalledOnce();
    expect(onOpenAIEvidence).toHaveBeenCalledWith(evidence);
    expect(onFirecrawlEvidence).toHaveBeenCalledOnce();
    expect(onFirecrawlEvidence).toHaveBeenCalledWith(evidence);
    expect(events).toEqual([
      "execute:openai_web_search",
      "hydrate:openai",
      "execute:firecrawl_web_search",
      "hydrate:firecrawl",
    ]);
  });

  test.each(["openai", "firecrawl"] as const)(
    "charges replayed %s agent-tool calls against the shared budget",
    async (firstProvider) => {
      const evidence = buildBottleSearchEvidence({
        provider: firstProvider,
        query: "laphroaig cairdeas 2022 warehouse 1",
        summary: "Laphroaig confirms the Warehouse 1 release.",
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
      const executeWebSearch: BottleWebSearchExecutor = vi.fn(
        async () => evidence,
      );
      const budget = createBottleWebSearchBudget(1);
      const tools = {
        openai: createOpenAIWebSearchTool({
          client: {} as OpenAI,
          model: "gpt-5.4",
          budget,
          executeWebSearch,
        }),
        firecrawl: createFirecrawlWebSearchTool({
          apiKey: "firecrawl-test-key",
          budget,
          executeWebSearch,
        }),
      };
      const args = JSON.stringify({
        query: "laphroaig cairdeas 2022 warehouse 1",
      });

      await tools[firstProvider].invoke({} as never, args);
      const secondProvider =
        firstProvider === "openai" ? "firecrawl" : "openai";
      const exhausted = await tools[secondProvider].invoke({} as never, args);

      expect(executeWebSearch).toHaveBeenCalledOnce();
      expect(executeWebSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: `${firstProvider}_web_search`,
        }),
      );
      expect(exhausted).toEqual({
        error: "Search budget exhausted after 1 queries",
      });
    },
  );

  test("does not hydrate twice when a custom executor uses live execution", async () => {
    const client = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: [
            "[Official product](https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky)",
            "[Independent listing](https://www.whiskybase.com/whiskies/whisky/209611/laphroaig-cairdeas)",
          ].join(" "),
          output: [],
        }),
      },
    } as unknown as OpenAI;
    const onEvidence = vi.fn();
    const budget = createBottleWebSearchBudget(1);
    const tool = createOpenAIWebSearchTool({
      client,
      model: "gpt-5.4",
      budget,
      executeWebSearch: async ({ execute }) => await execute(),
      onEvidence,
    });

    await tool.invoke(
      {} as never,
      JSON.stringify({ query: "laphroaig cairdeas warehouse 1" }),
    );

    expect(onEvidence).toHaveBeenCalledOnce();
    expect(client.responses.create).toHaveBeenCalledOnce();
    await expect(
      tool.invoke(
        {} as never,
        JSON.stringify({ query: "laphroaig cairdeas warehouse 1 again" }),
      ),
    ).resolves.toEqual({
      error: "Search budget exhausted after 1 queries",
    });
  });

  test("does not double-charge Firecrawl when a custom executor delegates live", async () => {
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
      const budget = createBottleWebSearchBudget(1);
      const tool = createFirecrawlWebSearchTool({
        apiKey: "firecrawl-test-key",
        budget,
        executeWebSearch: async ({ execute }) => await execute(),
      });

      await tool.invoke(
        {} as never,
        JSON.stringify({ query: "laphroaig cairdeas warehouse 1" }),
      );

      expect(fetch).toHaveBeenCalledOnce();
      await expect(
        tool.invoke(
          {} as never,
          JSON.stringify({ query: "laphroaig cairdeas warehouse 1 again" }),
        ),
      ).resolves.toEqual({
        error: "Search budget exhausted after 1 queries",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("caps bottle search evidence payload size", () => {
    const decisiveFact = "The bottle has an 8-year age statement.";
    const evidence = buildBottleSearchEvidence({
      provider: "firecrawl",
      query: "ardbeg traigh bhan 19",
      summary: ["x".repeat(450), decisiveFact, "y".repeat(500)].join(" "),
      results: Array.from({ length: 12 }, (_, index) => ({
        title: `Result ${index + 1} ${"y".repeat(300)}`,
        url: `https://example.com/${index + 1}`,
        domain: "example.com",
        description: "z".repeat(400),
        extraSnippets: ["a".repeat(250), "b".repeat(250)],
      })),
    });

    expect(evidence.summary).toHaveLength(600);
    expect(evidence.summary).toContain(decisiveFact);
    expect(evidence.results).toHaveLength(6);
    for (const result of evidence.results) {
      expect(result.title.length).toBeLessThanOrEqual(160);
      expect((result.description ?? "").length).toBeLessThanOrEqual(220);
      expect(result.extraSnippets.length).toBeLessThanOrEqual(1);
      expect((result.extraSnippets[0] ?? "").length).toBeLessThanOrEqual(180);
    }
  });

  test("requests OpenAI web search sources in the response payload", () => {
    const request = buildOpenAIWebSearchRequest({
      model: "gpt-5.4",
      query: "lagavulin distillers edition 2023",
      instructions: "Search the web.",
    });

    expect(request).toEqual(
      expect.objectContaining({
        include: ["web_search_call.action.sources"],
      }),
    );
  });
});
